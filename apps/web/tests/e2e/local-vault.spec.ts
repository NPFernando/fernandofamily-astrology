import { expect, test, type Page } from '@playwright/test'
import { DICTS, expectMainBird, fillManualLocation } from './helpers'

const PASSPHRASE = 'correct horse battery staple'
const BIRTH_DATE = '2000-01-01'
const BIRTH_TIME = '12:00'
const LOCATION = {
  name: 'Private test location',
  latitude: 7.2906,
  longitude: 80.6337,
  iana_tz: 'Asia/Colombo'
}

const LEGACY_KEYS = [
  'ff_recent_birth_details',
  'ff_recent_locations',
  'ff_last_schedule_cache',
  'ff_selected_bird',
  'ff_session_schedule',
  'ff_live_schedule_seed',
  'ff_derived_identity_seed'
] as const

async function createVault(page: Page, passphrase = PASSPHRASE) {
  await page.getByRole('button', { name: 'Protect private data' }).click()
  await page.getByLabel('Choose a vault passphrase').fill(passphrase)
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.locator('[title="Private data vault unlocked for this tab"]')).toBeVisible()
}

async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('Vault backup download stream was unavailable.')
  let content = ''
  for await (const chunk of stream) content += chunk.toString()
  return content
}

test('legacy private data receives a visible migration deadline before vault creation', async ({ page }) => {
  await page.goto('/en/birth-chart')
  await page.evaluate(() => {
    window.localStorage.setItem('ff_recent_birth_details', '[{"birth_date":"2000-01-01","birth_time":"12:00"}]')
  })
  await page.reload()

  await page.getByRole('button', { name: 'Protect private data' }).click()
  await expect(
    page.getByText('Private data from an older version is waiting to be encrypted.', { exact: false })
  ).toBeVisible()
  await expect(page.getByText('2027-02-01', { exact: false })).toBeVisible()
})

test('invalid legacy account location can be discarded only after explicit confirmation', async ({ page }) => {
  let accountLocationPending = true
  let invalidLocationDiscard: { revision?: string; discard_invalid?: boolean } | null = null
  await page.route('**/api/account/preferences', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preferences: { locale: 'en', theme: null, default_bird: null, default_location: null }, legacy_location_pending: accountLocationPending })
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: null }) })
  })
  await page.route('**/api/account/preferences/migrate-location', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ location: null, revision: '0123456789abcdef0123456789abcdef', pending: true, invalid_legacy_location: true })
      })
    }
    invalidLocationDiscard = route.request().postDataJSON()
    accountLocationPending = false
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cleared: true }) })
  })
  await page.goto('/en/privacy')
  await createVault(page)
  await expect(page.getByText('A legacy account location has an unsupported format', { exact: false })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete invalid legacy location' }).click()
  await expect(page.getByText('A legacy account location has an unsupported format', { exact: false })).toHaveCount(0)
  expect(invalidLocationDiscard).toEqual({ revision: '0123456789abcdef0123456789abcdef', discard_invalid: true })
})

test('a cross-tab lock cancels an in-flight vault unlock without writing stale migration state', async ({ page }) => {
  await page.goto('/en/birth-chart')
  const legacy = JSON.stringify([{ birth_date: BIRTH_DATE, birth_time: BIRTH_TIME }])
  await page.evaluate(value => window.localStorage.setItem('ff_recent_birth_details', value), legacy)
  await page.reload()

  let signalReadStarted!: () => void
  let releaseMigration!: () => void
  const migrationReadStarted = new Promise<void>(resolve => { signalReadStarted = resolve })
  const migrationGate = new Promise<void>(resolve => { releaseMigration = resolve })
  await page.route('**/api/account/preferences/migrate-location', async route => {
    if (route.request().method() !== 'GET') return route.continue()
    signalReadStarted()
    await migrationGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ location: null, revision: null, invalid_legacy_location: false })
    })
  })

  try {
    await page.getByRole('button', { name: 'Protect private data' }).click()
    await page.getByLabel('Choose a vault passphrase').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Create vault' }).click()
    await migrationReadStarted

    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'ff_private_vault_lock_signal_v1',
        newValue: 'cross-tab-lock',
        storageArea: window.localStorage
      }))
    })
    releaseMigration()

    await expect(page.getByRole('button', { name: 'Protect private data' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ff_private_vault_v1'))).toBeNull()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ff_recent_birth_details'))).toBe(legacy)
    await expect(page.locator('input[type="date"]')).not.toHaveValue(BIRTH_DATE)
  } finally {
    releaseMigration()
    await page.unroute('**/api/account/preferences/migrate-location')
  }
})

test('privacy page: private data center hides counts while the vault is locked', async ({ page }) => {
  await page.goto('/en/privacy')
  const center = page.locator('[data-testid="privacy-data-center"]')
  await expect(center).toBeVisible()
  await expect(center).toContainText(DICTS.en.ui.dataCenterEmpty)
  await expect(center).toContainText('—')
  await expect(center.getByRole('button', { name: DICTS.en.ui.dataCenterExportProfiles })).toBeVisible()
})

test('account-synced legacy location is reported while the local vault is locked', async ({ page }) => {
  await page.route('**/api/account/preferences', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferences: { locale: 'en', theme: null, default_bird: null, default_location: null }, legacy_location_pending: true })
    })
  })
  await page.goto('/en/privacy')
  await expect(page.getByTestId('privacy-data-center')).toContainText(
    'Legacy private or account-synced data is waiting for encrypted vault migration.'
  )
})

test('local vault migrates sensitive legacy values, restores them after unlock, and clears them', async ({ page }) => {
  await page.goto('/en/birth-chart')
  const legacyValues = [
    ['local', 'ff_recent_birth_details', `[{"birth_date":"${BIRTH_DATE}","birth_time":"${BIRTH_TIME}"}]`],
    ['local', 'ff_recent_locations', JSON.stringify([LOCATION])],
    [
      'local',
      'ff_last_schedule_cache',
      JSON.stringify({
        schedule: { location: LOCATION, birth_bird: 'peacock' },
        cachedAtIso: '2026-08-05T00:00:00.000Z'
      })
    ],
    ['local', 'ff_selected_bird', 'peacock'],
    [
      'session',
      'ff_session_schedule',
      JSON.stringify({ schedule: { location: LOCATION }, serverTimeIso: null, fetchedAtClientMs: 1 })
    ],
    [
      'session',
      'ff_live_schedule_seed',
      JSON.stringify({
        schedule: { location: LOCATION },
        request: { latitude: LOCATION.latitude, longitude: LOCATION.longitude },
        serverTimeIso: null,
        fetchedAtClientMs: 1
      })
    ],
    [
      'session',
      'ff_derived_identity_seed',
      JSON.stringify({
        bird: 'peacock',
        nakshatra_index: null,
        paksha: null,
        moon_rashi_index: null,
        savedAtIso: '2026-08-05T00:00:00.000Z'
      })
    ]
  ] as const
  await page.evaluate(entries => {
    for (const [scope, key, value] of entries) {
      ;(scope === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value)
    }
  }, legacyValues)

  await createVault(page)
  const migrated = await page.evaluate(
    keys => ({
      vault: window.localStorage.getItem('ff_private_vault_v1'),
      salt: window.localStorage.getItem('ff_private_vault_salt_v1'),
      local: keys.slice(0, 4).map(key => window.localStorage.getItem(key)),
      session: keys.slice(4).map(key => window.sessionStorage.getItem(key))
    }),
    [...LEGACY_KEYS]
  )
  expect(migrated.vault).toContain('ciphertext')
  expect(migrated.salt).toBeTruthy()
  expect(migrated.vault).not.toContain(BIRTH_DATE)
  expect(migrated.vault).not.toContain(String(LOCATION.latitude))
  expect(migrated.local).toEqual([null, null, null, null])
  expect(migrated.session).toEqual([null, null, null])

  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await page.getByRole('button', { name: 'Lock private data' }).click()
  await expect(page.getByRole('button', { name: 'Unlock private data' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).not.toHaveValue(BIRTH_DATE)
  await expect(page.getByText(LOCATION.name, { exact: true })).not.toBeVisible()

  // A new page shares browser storage but not this tab's in-memory key or
  // location cache. It must see only encrypted ciphertext and remain locked.
  const lockedTab = await page.context().newPage()
  await lockedTab.goto('/en/birth-chart')
  await expect(lockedTab.getByRole('button', { name: 'Unlock private data' })).toBeVisible()
  await expect(lockedTab.getByText(LOCATION.name, { exact: true })).not.toBeVisible()
  const lockedStorage = await lockedTab.evaluate(
    keys => ({
      local: keys.slice(0, 4).map(key => window.localStorage.getItem(key)),
      session: keys.slice(4).map(key => window.sessionStorage.getItem(key))
    }),
    [...LEGACY_KEYS]
  )
  expect(lockedStorage.local).toEqual([null, null, null, null])
  expect(lockedStorage.session).toEqual([null, null, null])
  await lockedTab.getByRole('button', { name: 'Unlock private data' }).click()
  await lockedTab.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await lockedTab.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(lockedTab.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(lockedTab.locator('input[type="time"]')).toHaveValue(BIRTH_TIME)
  await lockedTab.close()

  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill('wrong passphrase')
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.getByText('That passphrase could not unlock this vault.', { exact: true })).toBeVisible()

  await page.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME)

  await page.goto('/en/privacy')
  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.getByRole('button', { name: DICTS.en.ui.dataCenterClearEphemeral })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: DICTS.en.ui.dataCenterClearEphemeral }).click()
  await expect(page.getByTestId('privacy-data-center')).toContainText(DICTS.en.ui.dataCenterClearEphemeralDone)
  await expect(page.getByTestId('privacy-data-center')).toContainText(`${DICTS.en.ui.dataCenterBirthDetails}0`)
  await expect(page.getByTestId('privacy-data-center')).toContainText(`${DICTS.en.ui.dataCenterCachedGuides}0`)

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Clear saved preferences' }).click()
  const cleared = await page.evaluate(
    keys => ({
      vault: window.localStorage.getItem('ff_private_vault_v1'),
      salt: window.localStorage.getItem('ff_private_vault_salt_v1'),
      local: keys.slice(0, 4).map(key => window.localStorage.getItem(key)),
      session: keys.slice(4).map(key => window.sessionStorage.getItem(key))
    }),
    [...LEGACY_KEYS]
  )
  expect(cleared.vault).toBeNull()
  expect(cleared.salt).toBeNull()
  expect(cleared.local).toEqual([null, null, null, null])
  expect(cleared.session).toEqual([null, null, null])
})

test('account-synced legacy location is encrypted before server cleanup', async ({ page }) => {
  const legacyLocation = {
    name: 'Legacy account location',
    latitude: 7.2906,
    longitude: 80.6337,
    iana_tz: 'Asia/Colombo'
  }
  const revision = 'legacy-location-revision-1'
  let encryptedSnapshotAtClear: string | null = null
  let clearedRevision: unknown

  await page.route('**/api/account/preferences/migrate-location', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ location: legacyLocation, revision })
      })
      return
    }

    clearedRevision = route.request().postDataJSON()?.revision
    encryptedSnapshotAtClear = await page.evaluate(() =>
      window.localStorage.getItem('ff_private_vault_v1')
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cleared: clearedRevision === revision })
    })
  })

  await page.goto('/en/birth-chart')
  await createVault(page)

  expect(clearedRevision).toBe(revision)
  expect(encryptedSnapshotAtClear).toContain('ciphertext')
  expect(encryptedSnapshotAtClear).not.toContain(legacyLocation.name)
  expect(encryptedSnapshotAtClear).not.toContain(String(legacyLocation.latitude))

  const decrypted = await page.evaluate(async passphrase => {
    const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0))
    const salt = decode(window.localStorage.getItem('ff_private_vault_salt_v1') ?? '')
    const encrypted = JSON.parse(window.localStorage.getItem('ff_private_vault_v1') ?? '{}')
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(encrypted.iv) },
      key,
      decode(encrypted.ciphertext)
    )
    return JSON.parse(new TextDecoder().decode(plaintext))
  }, PASSPHRASE)
  expect(decrypted.defaultLocation).toEqual(legacyLocation)
})

test('account-location migration outage remains visibly pending after vault creation', async ({ page }) => {
  await page.route('**/api/account/preferences/migrate-location', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' })
      return
    }
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' })
  })

  await page.goto('/en/privacy')
  await createVault(page)
  await expect(page.getByTestId('privacy-data-center')).toContainText(
    'Legacy private or account-synced data is waiting for encrypted vault migration.'
  )
})

test('a fresh live schedule is persisted only in the encrypted vault', async ({ page }) => {
  await page.goto('/en/pancha-pakshi')
  await createVault(page)
  const initialCiphertext = await page.evaluate(() =>
    window.localStorage.getItem('ff_private_vault_v1')
  )

  await page.getByRole('tab', { name: DICTS.en.ui.methodDirectBird }).click()
  await page.getByRole('button', { name: DICTS.en.enums.birds.owl, exact: true }).click()
  await fillManualLocation(page, 'en', {
    lat: '7.2906',
    lon: '80.6337',
    tz: 'Asia/Colombo'
  })
  await page.getByRole('button', { name: DICTS.en.ui.calculate, exact: true }).click()
  await expectMainBird(page, 'en', 'owl')
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('ff_private_vault_v1')))
    .not.toBe(initialCiphertext)
  await page.getByRole('link', { name: DICTS.en.ui.liveView, exact: true }).click()
  await page.waitForURL(/\/en\/pancha-pakshi\/live$/)

  const liveView = page.getByTestId('ambient-live-view')
  await expect(liveView).toBeVisible({ timeout: 75_000 })

  const persisted = await page.evaluate(async ({ keys, passphrase }) => {
    const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0))
    const salt = decode(window.localStorage.getItem('ff_private_vault_salt_v1') ?? '')
    const encrypted = JSON.parse(window.localStorage.getItem('ff_private_vault_v1') ?? '{}')
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    )
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(encrypted.iv) },
      key,
      decode(encrypted.ciphertext)
    )
    return {
      ciphertext: window.localStorage.getItem('ff_private_vault_v1'),
      decrypted: JSON.parse(new TextDecoder().decode(plaintext)),
      legacyLocal: keys.slice(0, 4).map(name => window.localStorage.getItem(name)),
      legacySession: keys.slice(4).map(name => window.sessionStorage.getItem(name))
    }
  }, { keys: [...LEGACY_KEYS], passphrase: PASSPHRASE })
  expect(persisted.ciphertext).not.toBe(initialCiphertext)
  expect(persisted.decrypted.cachedSchedule.schedule.location).toMatchObject({
    latitude: 7.2906,
    longitude: 80.6337,
    iana_tz: 'Asia/Colombo'
  })
  expect(persisted.decrypted.sessionSchedule.schedule.location).toMatchObject({
    latitude: 7.2906,
    longitude: 80.6337,
    iana_tz: 'Asia/Colombo'
  })
  expect(persisted.decrypted.liveScheduleSeed.request).toMatchObject({
    latitude: 7.2906,
    longitude: 80.6337,
    iana_tz: 'Asia/Colombo'
  })
  expect(persisted.ciphertext).not.toContain(String(7.2906))
  expect(persisted.ciphertext).not.toContain(String(80.6337))
  expect(persisted.legacyLocal).toEqual([null, null, null, null])
  expect(persisted.legacySession).toEqual([null, null, null])

  await page.getByRole('link', { name: DICTS.en.ui.exitLiveView, exact: true }).click()
  await page.waitForURL(/\/en\/pancha-pakshi$/)
  await page.getByRole('button', { name: 'Lock private data' }).click()
  await expect(page.getByRole('button', { name: 'Unlock private data' })).toBeVisible()
  const liveViewLink = page.getByRole('link', { name: DICTS.en.ui.liveView, exact: true })
  await expect(liveViewLink).toBeVisible({ timeout: 75_000 })
  await liveViewLink.click()
  await page.waitForURL(/\/en\/pancha-pakshi\/live$/)
  const lockedLiveView = page.getByTestId('ambient-live-view')
  await expect(lockedLiveView).toBeVisible({ timeout: 75_000 })
  await expect(lockedLiveView).toContainText('Colombo, Sri Lanka')
  await expect(lockedLiveView).not.toContainText('7.2906')
  await expect(lockedLiveView).not.toContainText('80.6337')
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ff_private_vault_v1'))).not.toBeNull()
})

test('locking one tab clears decrypted state in other tabs and requires re-unlock', async ({ page }) => {
  await page.goto('/en/birth-chart')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'ff_recent_birth_details',
      JSON.stringify([{ birth_date: '2000-01-01', birth_time: '12:00' }])
    )
  })
  await page.reload()
  await createVault(page)
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)

  const secondTab = await page.context().newPage()
  await secondTab.goto('/en/birth-chart')
  await secondTab.getByRole('button', { name: 'Unlock private data' }).click()
  await secondTab.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await secondTab.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(secondTab.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(page.getByRole('button', { name: 'Lock private data' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)

  await secondTab.evaluate(() => {
    ;(window as Window & { __vaultStorageEvents?: string[] }).__vaultStorageEvents = []
    window.addEventListener('storage', event => {
      ;(window as Window & { __vaultStorageEvents?: string[] }).__vaultStorageEvents?.push(event.key ?? '')
    })
  })
  await page.getByRole('button', { name: 'Lock private data' }).click()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('ff_private_vault_lock_signal_v1')))
    .not.toBeNull()
  await expect
    .poll(() => secondTab.evaluate(() => (window as Window & { __vaultStorageEvents?: string[] }).__vaultStorageEvents))
    .toContain('ff_private_vault_lock_signal_v1')
  await expect(secondTab.getByRole('button', { name: 'Unlock private data' })).toBeVisible()
  await expect(secondTab.locator('input[type="date"]')).not.toHaveValue(BIRTH_DATE)
  await expect.poll(() => secondTab.evaluate(() => window.localStorage.getItem('ff_private_vault_v1'))).not.toBeNull()

  await secondTab.getByRole('button', { name: 'Unlock private data' }).click()
  await secondTab.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await secondTab.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(secondTab.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await secondTab.close()
})

test('account session expiry locks the private vault without deleting encrypted data', async ({ page }) => {
  let expired = false
  let sessionRequests = 0
  await page.route('**/api/auth/session', async route => {
    sessionRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(expired ? {} : { user: { email: 'vault-user@example.test' } })
    })
  })

  await page.goto('/en/birth-chart')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'ff_recent_birth_details',
      JSON.stringify([{ birth_date: '2000-01-01', birth_time: '12:00' }])
    )
  })
  await page.reload()
  await createVault(page)
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)

  expired = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => sessionRequests).toBeGreaterThan(1)
  await expect(page.getByRole('button', { name: 'Unlock private data' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).not.toHaveValue(BIRTH_DATE)
  await expect(page.getByRole('button', { name: DICTS.en.ui.signIn })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('ff_private_vault_v1')))
    .not.toBeNull()
})

test('vault backup is ciphertext-only and restores only after the original passphrase is supplied', async ({
  page,
  browser
}) => {
  await page.goto('/en/birth-chart')
  await page.evaluate(location => {
    window.localStorage.setItem(
      'ff_recent_birth_details',
      JSON.stringify([{ birth_date: '2000-01-01', birth_time: '12:00' }])
    )
    window.localStorage.setItem('ff_recent_locations', JSON.stringify([location]))
  }, LOCATION)
  await createVault(page)
  await page.getByRole('link', { name: 'Daily Guide', exact: true }).click()
  await page.getByRole('link', { name: 'Open private planner', exact: true }).click()
  await page.getByLabel('Plan title').fill('Private temple reminder')
  await page.getByRole('button', { name: 'Add to agenda' }).click()
  await expect(page.getByTestId('planner-agenda')).toContainText('Private temple reminder')
  await page.getByRole('link', { name: 'Privacy', exact: true }).click()
  await expect(page.locator('[data-testid="vault-recovery-checklist"]')).toContainText('Recovery checklist')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('vault-backup-download').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('fernando-family-private-vault-v1.json')
  const backup = await readDownload(download)
  expect(backup).toContain('"format":"fernandofamily-private-vault"')
  expect(backup).toContain('"ciphertext"')
  expect(backup).not.toContain(BIRTH_DATE)
  expect(backup).not.toContain(String(LOCATION.latitude))
  expect(backup).not.toContain('Private temple reminder')

  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3199' })
  const restored = await context.newPage()
  await restored.goto('/en/privacy')
  await expect.poll(() => restored.evaluate(() => window.localStorage.getItem('ff_private_vault_v1'))).toBeNull()
  await restored.getByTestId('vault-backup-upload').setInputFiles({
    name: 'fernando-family-private-vault-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup)
  })
  await expect(
    restored.getByText('Backup restored. Unlock the vault with its original passphrase.', { exact: true })
  ).toBeVisible()
  await expect(restored.getByText('Restore encrypted backup', { exact: true })).toBeDisabled()

  await restored.goto('/en/birth-chart')
  await restored.getByRole('button', { name: 'Unlock private data' }).click()
  await restored.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await restored.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(restored.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(restored.locator('input[type="time"]')).toHaveValue(BIRTH_TIME)
  await restored.getByRole('link', { name: 'Daily Guide', exact: true }).click()
  await restored.getByRole('link', { name: 'Open private planner', exact: true }).click()
  await expect(restored.getByTestId('planner-agenda')).toContainText('Private temple reminder')
  await context.close()
})

test('vault backup rejects invalid files without creating a vault', async ({ page }) => {
  await page.goto('/en/privacy')
  await page.getByTestId('vault-backup-upload').setInputFiles({
    name: 'invalid-vault.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"not-a-vault"}')
  })
  await expect(page.getByText('This backup file is invalid or unsupported.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Protect private data' })).toBeVisible()
})

test('vault passphrase rotation re-encrypts data and invalidates the previous passphrase', async ({ page }) => {
  const newPassphrase = 'new correct horse battery staple'
  await page.goto('/en/birth-chart')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'ff_recent_birth_details',
      JSON.stringify([{ birth_date: '2000-01-01', birth_time: '12:00' }])
    )
  })
  await createVault(page)
  const before = await page.evaluate(() => ({
    salt: window.localStorage.getItem('ff_private_vault_salt_v1'),
    payload: window.localStorage.getItem('ff_private_vault_v1')
  }))

  await page.goto('/en/privacy')
  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await page.getByLabel('New vault passphrase').fill(newPassphrase)
  await page.getByLabel('Confirm new passphrase').fill(newPassphrase)
  await page.getByRole('button', { name: 'Change vault passphrase' }).click()
  await expect(
    page.getByText('Vault passphrase changed. Download a new encrypted backup.', { exact: true })
  ).toBeVisible()
  const after = await page.evaluate(() => ({
    salt: window.localStorage.getItem('ff_private_vault_salt_v1'),
    payload: window.localStorage.getItem('ff_private_vault_v1'),
    rotation: window.localStorage.getItem('ff-vault-transaction')
  }))
  expect(after.salt).not.toBe(before.salt)
  expect(after.payload).not.toBe(before.payload)
  expect(after.payload).not.toContain(BIRTH_DATE)
  expect(after.rotation).toBeNull()
  await expect(page.getByTestId('vault-backup-recommended')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('vault-backup-download').click()
  await downloadPromise
  await expect(page.getByTestId('vault-backup-recommended')).not.toBeVisible()

  await page.getByRole('button', { name: 'Lock private data' }).click()
  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.getByText('That passphrase could not unlock this vault.', { exact: true })).toBeVisible()

  await page.getByLabel('Vault passphrase').fill(newPassphrase)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await page.goto('/en/birth-chart')
  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill(newPassphrase)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME)

  // Simulate a tab being interrupted between the new salt and new ciphertext
  // writes. The next page must recover the previous authenticated pair rather
  // than leave the vault unreadable.
  if (!before.salt || !before.payload || !after.salt || !after.payload) {
    throw new Error('Expected both vault storage pairs for rotation recovery test.')
  }
  await page.evaluate(
    ({ previous, next }) => {
      window.localStorage.setItem('ff-vault-transaction', JSON.stringify({ version: 1, previous, next }))
      window.localStorage.setItem('ff_private_vault_salt_v1', next.salt)
      window.localStorage.setItem('ff_private_vault_v1', JSON.stringify(previous.payload))
    },
    {
      previous: { salt: before.salt, payload: JSON.parse(before.payload) },
      next: { salt: after.salt, payload: JSON.parse(after.payload) }
    }
  )
  await page.reload()
  await page.getByRole('button', { name: 'Unlock private data' }).click()
  await page.getByLabel('Vault passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE)
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ff-vault-transaction'))).toBeNull()
})
