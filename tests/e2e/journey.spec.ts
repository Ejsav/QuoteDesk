import { expect, test, type Page } from "@playwright/test";

/**
 * The acceptance journey from the brief, end to end against a production
 * build: create a customer → inquiry → edit → status → follow-up → note,
 * survive a reload, see the dashboard change, find it through search.
 */

test.describe.configure({ mode: "serial" });

function businessDate(daysFromToday: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + daysFromToday * 86_400_000),
  );
}

async function kpi(page: Page, label: string): Promise<number> {
  const text = await page.getByRole("region", { name: "Key metrics" }).getByRole("link", { name: new RegExp(`^${label}`) }).innerText();
  const match = new RegExp(`${label}\\s+(\\d+)`).exec(text.replace(/\n/g, " "));
  if (!match) throw new Error(`KPI ${label} not found in: ${text}`);
  return Number(match[1]);
}

test("Command Center renders metrics computed from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  for (const label of ["Received · 7 days", "Awaiting contact", "Active leads", "Qualified", "Follow-ups due", "Trips · next 14 days"]) {
    expect(await kpi(page, label)).toBeGreaterThanOrEqual(0);
  }
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inquiry volume" })).toBeVisible();
});

test("customer → inquiry → edit → status → follow-up → note, persisted and reflected on the dashboard", async ({ page }) => {
  await page.goto("/");
  const qualifiedBefore = await kpi(page, "Qualified");

  // 1. Create a customer.
  await page.goto("/customers");
  await page.getByRole("button", { name: "New customer" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Taylor Quinn");
  await dialog.getByLabel("Phone").fill("(312) 555-0199");
  await dialog.getByLabel("Email").fill("taylor.quinn@example.com");
  await dialog.getByRole("button", { name: "Create customer" }).click();
  await expect(page).toHaveURL(/\/customers\/cus_/);
  await expect(page.getByRole("heading", { level: 1, name: "Taylor Quinn" })).toBeVisible();

  // 2. Create an inquiry for that customer.
  await page.getByRole("main").getByRole("link", { name: "New inquiry" }).first().click();
  await expect(page).toHaveURL(/\/leads\/new\?customerId=cus_/);
  await expect(page.getByText("Taylor Quinn").first()).toBeVisible();
  await page.getByLabel("Occasion").selectOption("corporate");
  await page.getByLabel("Event name").fill("Quinn & Co. holiday party");
  await page.getByLabel("Trip date").fill(businessDate(20));
  await page.getByLabel("Pickup time").fill("18:30");
  await page.getByLabel("Pickup location").fill("The Larkspur Hotel");
  await page.getByRole("radio", { name: "Exact" }).click();
  await page.getByLabel("Exact passenger count").fill("12");
  await page.getByLabel("Source").selectOption("referral");
  await page.getByRole("button", { name: "Create inquiry" }).first().click();
  await expect(page).toHaveURL(/\/leads\/lead_[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quinn & Co. holiday party" })).toBeVisible();
  const leadUrl = page.url();

  // 3. Edit: passenger range + destination.
  await page.getByRole("main").getByRole("link", { name: "Edit" }).first().click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("radio", { name: "Range" }).click();
  await page.getByLabel("Fewest passengers").fill("12");
  await page.getByLabel("Most passengers").fill("14");
  await page.getByLabel("Destination").fill("Cedar & Vine");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page).toHaveURL(leadUrl);
  await expect(page.getByText("12–14").first()).toBeVisible();
  await expect(page.getByText("Cedar & Vine").first()).toBeVisible();

  // 4. Status: New → Contacted → Qualified.
  await page.getByRole("button", { name: /Status: New/ }).first().click();
  await page.getByRole("menuitem", { name: /Contacted/ }).click();
  await expect(page.getByRole("button", { name: /Status: Contacted/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Status: Contacted/ }).first().click();
  await page.getByRole("menuitem", { name: /Qualified/ }).click();
  await expect(page.getByRole("button", { name: /Status: Qualified/ }).first()).toBeVisible();

  // 5. Follow-up tomorrow.
  const followUp = page.locator("#follow-up");
  await followUp.getByRole("button", { name: "Tomorrow" }).click();
  await expect(followUp.getByRole("button", { name: "Mark done" })).toBeVisible();

  // 6. Note.
  await page.getByPlaceholder(/Add an internal note/).fill("Client wants a coat check stop on the way back.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Client wants a coat check stop on the way back.")).toBeVisible();

  // 7. Survives a full reload.
  await page.reload();
  await expect(page.getByRole("button", { name: /Status: Qualified/ }).first()).toBeVisible();
  await expect(page.locator("#follow-up").getByRole("button", { name: "Mark done" })).toBeVisible();
  await expect(page.getByText("Client wants a coat check stop on the way back.")).toBeVisible();
  await expect(page.getByText("Moved from Contacted to Qualified")).toBeVisible();

  // 8. The dashboard reflects it.
  await page.goto("/");
  expect(await kpi(page, "Qualified")).toBe(qualifiedBefore + 1);
  await expect(page.getByText("Quinn & Co. holiday party").first()).toBeVisible();
});

test("leads can be searched, filtered and found from the command palette", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("searchbox", { name: "Search leads" }).fill("Quinn");
  await expect(page).toHaveURL(/q=Quinn/);
  await expect(page.getByRole("link", { name: "Quinn & Co. holiday party" })).toBeVisible();

  await page.goto("/leads?view=qualified");
  await expect(page.getByRole("link", { name: "Quinn & Co. holiday party" })).toBeVisible();
  await page.goto("/leads?view=new");
  await expect(page.getByRole("link", { name: "Quinn & Co. holiday party" })).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/Search leads, customers, operators/).fill("Taylor");
  // Both the inquiry (customer shown as context) and the customer record match.
  await expect(page.getByRole("option", { name: /^L-\d+ Quinn & Co\. holiday party/ })).toBeVisible();
  await page.getByRole("option", { name: /^Taylor Quinn/ }).click();
  await expect(page).toHaveURL(/\/customers\/cus_/);
});

test("validation explains problems and double submits create one inquiry", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByRole("button", { name: "Create inquiry" }).first().click();
  await expect(page.getByText("Choose a customer, or add a new one.")).toBeVisible();
  await expect(page.getByText("Choose how this inquiry came in.")).toBeVisible();

  await page.getByRole("button", { name: "+ New customer" }).click();
  await page.getByLabel("Full name").fill("Double Click Test");
  await page.getByLabel("Phone").fill("555-01");
  await page.getByLabel("Source").selectOption("phone");
  await page.getByRole("button", { name: "Create inquiry" }).first().click();
  await expect(page.getByText(/Enter a 10-digit US number/)).toBeVisible();

  await page.getByLabel("Phone").fill("(630) 555-0177");
  await page.getByRole("button", { name: "Create inquiry" }).first().dblclick();
  await expect(page).toHaveURL(/\/leads\/lead_[a-z0-9]+$/);

  await page.goto("/leads?view=all&q=Double+Click+Test");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});

test("operators can be created, given a vehicle and edited", async ({ page }) => {
  await page.goto("/operators/new");
  await page.getByLabel("Company name").fill("Test Coachworks QA");
  await page.getByLabel("Phone").fill("(847) 555-0190");
  await page.getByRole("button", { name: "Add operator" }).first().click();
  await expect(page).toHaveURL(/\/operators\/op_/);
  await expect(page.getByRole("heading", { level: 1, name: "Test Coachworks QA" })).toBeVisible();

  await page.getByRole("button", { name: /Add (the first )?vehicle/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").selectOption("party_bus");
  await dialog.getByLabel("Seated passengers").fill("30");
  await dialog.getByRole("button", { name: "Add vehicle" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Operator-reported").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("30 seats").first()).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Edit" }).first().click();
  await page.getByLabel("Contact name").fill("Morgan Reyes");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page).toHaveURL(/\/operators\/op_[a-z0-9]+$/);
  await expect(page.getByText("Morgan Reyes").first()).toBeVisible();
});

test("a lead's status and follow-up can be updated on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/leads?view=all&q=Quinn");
  await page.getByRole("link", { name: /Quinn & Co\. holiday party/ }).first().click();
  await expect(page).toHaveURL(/\/leads\/lead_/);
  await page.getByRole("button", { name: /Status: Qualified/ }).first().click();
  await page.getByRole("menuitem", { name: /On hold/ }).click();
  await expect(page.getByRole("button", { name: /Status: On hold/ }).first()).toBeVisible();
  const followUp = page.locator("#follow-up");
  await followUp.getByRole("button", { name: "Mark done" }).click();
  await expect(followUp.getByText("No follow-up scheduled.")).toBeVisible();
  await context.close();
});
