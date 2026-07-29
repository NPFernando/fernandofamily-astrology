import { expect, test } from "@playwright/test";

const familyCard = {
  locale: "si",
  date: "2026-07-23",
  location: {
    name: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    iana_tz: "Asia/Colombo",
  },
  profiles: [
    {
      label: "Amma",
      bird: "peacock",
      nakshatra_index: null,
      paksha: null,
      moon_rashi_index: null,
    },
  ],
};

const horoscopeCard = {
  locale: "si",
  birth: {
    birth_date: "2000-01-01",
    birth_time: "12:00:00",
    location_name: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    iana_tz: "Asia/Colombo",
  },
};

test("family almanac share card matches its visual baseline", async ({ request }) => {
  const response = await request.post("/api/share-family-card", { data: familyCard });
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");
  await expect(await response.body()).toMatchSnapshot("family-almanac-share-card.png");
});

test("horoscope report share card matches its visual baseline", async ({ request }) => {
  const response = await request.post("/api/share-horoscope-report", { data: horoscopeCard });
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");
  await expect(await response.body()).toMatchSnapshot("horoscope-report-share-card.png");
});
