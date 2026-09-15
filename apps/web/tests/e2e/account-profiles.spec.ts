import { encode } from 'next-auth/jwt'
import { Client } from 'pg'
import { test, expect } from '@playwright/test'
import { AUTH_E2E, PUSH_E2E } from '../../playwright.config'

const ownerEmail = 'astrology-e2e@example.test'
const otherEmail = 'other-e2e@example.test'

async function sessionCookie(email: string): Promise<string> {
  const token = await encode({
    token: { sub: email, email, name: 'Isolated E2E User' },
    secret: AUTH_E2E.secret,
    salt: AUTH_E2E.cookieName
  })
  return `${AUTH_E2E.cookieName}=${token}`
}

test.describe('authenticated saved-profile persistence', () => {
  test.skip(!PUSH_E2E.databaseEnabled, 'requires the disposable astrology E2E database')

  test('isolates profiles by signed-in identity and persists create/read/delete', async ({ request }) => {
    const owner = await sessionCookie(ownerEmail)
    const other = await sessionCookie(otherEmail)

    const session = await request.get('/api/auth/session', { headers: { Cookie: owner } })
    expect(session.ok()).toBeTruthy()
    expect((await session.json()).user.email).toBe(ownerEmail)

    const savedPreference = await request.put('/api/account/preferences', {
      headers: { Cookie: owner },
      data: {
        locale: 'en',
        default_bird: 'owl',
        // Account preferences accept presentation defaults only; arbitrary
        // birth details and locations must not enter the synced payload.
        birth_date: '1990-02-03',
        birth_time: '04:05:06',
        birthplace: { name: 'Private birthplace', latitude: 7.2906, longitude: 80.6337 }
      }
    })
    expect(savedPreference.status()).toBe(200)
    expect((await savedPreference.json()).preferences.default_location).toBeNull()
    const syncedPreference = await request.get('/api/account/preferences', { headers: { Cookie: owner } })
    const syncedBody = await syncedPreference.json()
    expect(syncedBody.preferences).toMatchObject({ locale: 'en', default_bird: 'owl' })
    expect(JSON.stringify(syncedBody)).not.toMatch(/birth_date|birth_time|Private birthplace|7\.2906|80\.6337/i)

    const client = new Client({ connectionString: process.env.ASTROLOGY_E2E_DATABASE_URL })
    await client.connect()
    try {
      await client.query(
        `INSERT INTO preferences (owner_email, default_location, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (owner_email) DO UPDATE SET default_location = EXCLUDED.default_location`,
        [ownerEmail, JSON.stringify({
          name: 'Legacy Kandy', latitude: 7.2906, longitude: 80.6337, iana_tz: 'Asia/Colombo'
        })]
      )
    } finally {
      await client.end()
    }
    const rejectedLocationWrite = await request.put('/api/account/preferences', {
      headers: { Cookie: owner },
      data: { default_location: { name: 'New location', latitude: 1, longitude: 1, iana_tz: 'Asia/Colombo' } }
    })
    expect(rejectedLocationWrite.status()).toBe(410)
    const sanitizedPreferences = await request.get('/api/account/preferences', { headers: { Cookie: owner } })
    expect(await sanitizedPreferences.json()).toMatchObject({
      preferences: { default_location: null }, legacy_location_pending: true
    })
    const migrationRead = await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })
    const migration = await migrationRead.json()
    expect(migration.pending).toBe(true)
    expect(migration.location).toMatchObject({ name: 'Legacy Kandy', latitude: 7.2906, longitude: 80.6337 })
    const staleClear = await request.post('/api/account/preferences/migrate-location', {
      headers: { Cookie: owner },
      data: { revision: '2000-01-01T00:00:00.000Z' }
    })
    expect((await staleClear.json()).cleared).toBe(false)
    expect((await (await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })).json()).location.name)
      .toBe('Legacy Kandy')
    const refusedValidLocationDiscard = await request.post('/api/account/preferences/migrate-location', {
      headers: { Cookie: owner },
      data: { revision: migration.revision, discard_invalid: true }
    })
    expect(refusedValidLocationDiscard.status()).toBe(409)
    expect((await (await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })).json()).pending)
      .toBe(true)
    const clearMigratedLocation = await request.post('/api/account/preferences/migrate-location', {
      headers: { Cookie: owner }, data: { revision: migration.revision }
    })
    expect((await clearMigratedLocation.json()).cleared).toBe(true)
    const clearedLocation = await (await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })).json()
    expect(clearedLocation.location).toBeNull()
    expect(clearedLocation.pending).toBe(false)

    const invalidClient = new Client({ connectionString: process.env.ASTROLOGY_E2E_DATABASE_URL })
    await invalidClient.connect()
    try {
      await invalidClient.query(
        `UPDATE preferences SET default_location = $2::jsonb WHERE owner_email = $1`,
        [ownerEmail, JSON.stringify({ name: 'Malformed legacy value', latitude: 999, longitude: 80, iana_tz: 'Asia/Colombo' })]
      )
    } finally {
      await invalidClient.end()
    }
    const invalidMigrationRead = await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })
    const invalidMigration = await invalidMigrationRead.json()
    expect(invalidMigration).toMatchObject({ location: null, pending: true, invalid_legacy_location: true })
    expect(Number.isFinite(Date.parse(invalidMigration.revision))).toBe(true)
    const invalidDiscard = await request.post('/api/account/preferences/migrate-location', {
      headers: { Cookie: owner },
      data: { revision: invalidMigration.revision, discard_invalid: true }
    })
    expect(await invalidDiscard.json()).toMatchObject({ cleared: true })
    expect(await (await request.get('/api/account/preferences/migrate-location', { headers: { Cookie: owner } })).json())
      .toMatchObject({ location: null, pending: false, invalid_legacy_location: false })

    const create = await request.post('/api/account/profiles', {
      headers: { Cookie: owner },
      data: {
        label: 'Disposable profile',
        bird: 'owl',
        moon_rashi_index: 4,
        // The account-profile contract is derived-only, even if a client sends
        // stale/raw birth fields alongside an otherwise valid profile.
        birth_date: '1990-02-03',
        birth_time: '04:05:06',
        birthplace: { name: 'Private birthplace', latitude: 7.2906, longitude: 80.6337 }
      }
    })
    expect(create.status()).toBe(201)
    const { profile } = await create.json()
    expect(profile.label).toBe('Disposable profile')
    expect(profile.moon_rashi_index).toBe(4)
    expect(profile).not.toHaveProperty('birth_date')
    expect(profile).not.toHaveProperty('latitude')
    expect(profile).not.toHaveProperty('longitude')
    expect(JSON.stringify(profile)).not.toMatch(/1990-02-03|04:05:06|Private birthplace|7\.2906|80\.6337/i)

    const ownerList = await request.get('/api/account/profiles', { headers: { Cookie: owner } })
    const ownerProfiles = (await ownerList.json()).profiles
    expect(ownerProfiles.map((item: { id: string }) => item.id)).toContain(profile.id)
    expect(JSON.stringify(ownerProfiles)).not.toMatch(/1990-02-03|04:05:06|Private birthplace|7\.2906|80\.6337/i)

    const otherList = await request.get('/api/account/profiles', { headers: { Cookie: other } })
    expect((await otherList.json()).profiles).toEqual([])

    const forbiddenDelete = await request.delete(`/api/account/profiles/${profile.id}`, { headers: { Cookie: other } })
    expect(forbiddenDelete.status()).toBe(404)

    const remove = await request.delete(`/api/account/profiles/${profile.id}`, { headers: { Cookie: owner } })
    expect(remove.status()).toBe(200)

  })
})
