import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergePurchaseContact,
  orderContactMetadataPatch,
  purchaseContactFlags,
} from "@/lib/conversions/resolve-order-contact";
import {
  buildMetaCapiUserData,
  hashMetaCapiValue,
  normalizeMetaEmail,
  normalizeMetaPhone,
} from "@/lib/conversions/meta-capi";
import {
  buildTikTokEventsUser,
  hashTikTokEventsValue,
  normalizeTikTokPhone,
} from "@/lib/conversions/tiktok-events";

describe("S14 purchase contact matching", () => {
  it("merges overrides without dropping DB email/phone when only city is passed", () => {
    const merged = mergePurchaseContact(
      {
        email: "a@example.com",
        phone: "+51999888777",
        countryCode: "PE",
        city: "Lima",
      },
      { city: "Arequipa" },
    );
    assert.equal(merged.email, "a@example.com");
    assert.equal(merged.phone, "+51999888777");
    assert.equal(merged.city, "Arequipa");
    assert.equal(merged.countryCode, "PE");
  });

  it("builds user_data flags without raw PII", () => {
    const flags = purchaseContactFlags({
      email: "a@example.com",
      phone: null,
      countryCode: "PE",
      city: null,
    });
    assert.deepEqual(flags, {
      email_present: true,
      phone_present: false,
      country_present: true,
      city_present: false,
      external_id_hashed: true,
    });
  });

  it("patches order metadata with customer_email / customer_phone", () => {
    assert.deepEqual(
      orderContactMetadataPatch({
        email: " User@Example.COM ",
        phone: " +51 999 888 777 ",
      }),
      {
        customer_email: "user@example.com",
        customer_phone: "+51 999 888 777",
      },
    );
  });

  it("expands PE 9-digit mobiles before hashing for Meta and TikTok", () => {
    assert.equal(normalizeMetaPhone("999888777", "PE"), "51999888777");
    assert.equal(normalizeTikTokPhone("999 888 777", "pe"), "51999888777");
    assert.equal(normalizeMetaPhone("51999888777", "PE"), "51999888777");
  });

  it("includes hashed em/ph in Meta user_data when contact is present", () => {
    const userData = buildMetaCapiUserData({
      eventId: "purchase:ord-1",
      eventTimeUnix: 1,
      value: 10,
      currency: "PEN",
      orderId: "ord-1",
      email: "buyer@flipy.pe",
      phone: "999888777",
      countryCode: "PE",
    });
    assert.equal(userData.external_id, hashMetaCapiValue("ord-1"));
    assert.equal(userData.em, hashMetaCapiValue(normalizeMetaEmail("buyer@flipy.pe")));
    assert.equal(userData.ph, hashMetaCapiValue("51999888777"));
    assert.ok(!("email_present" in userData));
  });

  it("includes hashed email/phone_number in TikTok user when contact is present", () => {
    const user = buildTikTokEventsUser({
      eventId: "purchase:ord-1",
      eventTimeIso: new Date().toISOString(),
      value: 10,
      currency: "PEN",
      orderId: "ord-1",
      email: "buyer@flipy.pe",
      phone: "999888777",
      countryCode: "PE",
    });
    assert.equal(user.external_id, hashTikTokEventsValue("ord-1"));
    assert.equal(user.email, hashTikTokEventsValue("buyer@flipy.pe"));
    assert.equal(user.phone_number, hashTikTokEventsValue("51999888777"));
  });
});
