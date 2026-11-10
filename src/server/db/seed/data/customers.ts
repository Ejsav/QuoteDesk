/**
 * Demo customers. Every person and company here is fictional. Phone numbers
 * use the reserved 555-01XX fiction range; emails use reserved example
 * domains (RFC 2606). Customers with notes are added to the directory on
 * their own first; everyone else is created inline with their first inquiry.
 */
import type { SeedClock } from "../clock";
import type { CustomerSeed } from "../types";

export function customerSeeds(c: SeedClock): CustomerSeed[] {
  return [
    // --- Organizations and repeat accounts ---------------------------------
    {
      key: "harborpoint",
      fullName: "Meredith Shaw",
      companyName: "Harborpoint Capital",
      email: "meredith.shaw@harborpointcapital.example",
      phone: "(312) 555-0170",
      preferredContact: "email",
      notes:
        "Executive assistant to Harborpoint's COO. Prefers email and copies her assistant on confirmations. Sprinters for small groups, coaches for anything over 20.",
      addedAt: c.ago(84, "16:00"),
    },
    {
      key: "velvet",
      fullName: "Camille Archer",
      companyName: "Velvet & Vine Events",
      email: "camille@velvetandvine.example",
      phone: "(312) 555-0185",
      preferredContact: "phone",
      notes:
        "Lead planner at Velvet & Vine — sends us weddings regularly. Wants one point of contact per wedding and every timeline confirmed in writing.",
      addedAt: c.ago(79, "10:00"),
    },
    {
      key: "victor",
      fullName: "Victor Mensah",
      email: "victor.mensah@example.net",
      phone: "(312) 555-0105",
      preferredContact: "text",
      notes: "Frequent flyer — mostly early O'Hare departures. Prefers a sedan and the same chauffeur when possible. Quiet rides.",
      addedAt: c.ago(71, "18:00"),
    },
    {
      key: "oakhaven",
      fullName: "Rafael Mendes",
      companyName: "The Oakhaven Hotel",
      email: "rafael.mendes@oakhavenhotel.example",
      phone: "(312) 555-0191",
      preferredContact: "phone",
      notes: "Guest services manager at The Oakhaven Hotel in Streeterville. Refers hotel guests, conference groups and wedding blocks.",
      addedAt: c.ago(77, "09:00"),
    },
    {
      key: "lumen",
      fullName: "Kenji Watanabe",
      companyName: "Lumenfield Analytics",
      email: "kenji.watanabe@lumenfield.example",
      phone: "(312) 555-0123",
      preferredContact: "email",
      notes: "Office manager. Their finance team approves transportation over a set amount — raise budget questions early.",
      addedAt: c.ago(43, "09:00"),
    },
    {
      key: "aurora",
      fullName: "Sienna Clarke",
      companyName: "Aurora Bay DMC",
      email: "sienna.clarke@aurorabaydmc.example",
      phone: "(312) 555-0198",
      preferredContact: "email",
      notes: "Destination management company — incentive groups and conferences. Expects fast turnaround and a single itinerary document.",
      addedAt: c.ago(20, "09:00"),
    },
    { key: "corvane", fullName: "Linda Park", companyName: "Corvane Medical Group", email: "linda.park@corvanemedical.example", phone: "(312) 555-0147", preferredContact: "email" },
    { key: "pinnacle", fullName: "Gary Holcomb", companyName: "Pinnacle Forge Manufacturing", email: "gary.holcomb@pinnacleforge.example", phone: "(708) 555-0121", preferredContact: "phone" },
    { key: "wexley", fullName: "Patricia Gomez", companyName: "Wexley College Alumni Association", email: "pgomez@wexleyalumni.example", phone: "(630) 555-0176", preferredContact: "email" },
    { key: "kestrel", fullName: "Andrea Vogel", companyName: "Kestrel & Rowe LLP", email: "andrea.vogel@kestrelrowe.example", phone: "(312) 555-0159", preferredContact: "email" },
    { key: "tilde", fullName: "Noah Fischer", companyName: "Tilde Creative Studio", email: "noah@tildecreative.example", phone: "(773) 555-0187", preferredContact: "email" },
    { key: "calloway", fullName: "Liam O'Connell", companyName: "Calloway Rugby Club", email: "liam.oconnell@callowayrugby.example", phone: "(708) 555-0193", preferredContact: "text" },
    { key: "ridgeway", fullName: "Rachel Patterson", companyName: "Ridgeway High School PTO", email: "rpatterson@ridgewayhs-pto.example", phone: "(630) 555-0144", preferredContact: "email" },
    {
      key: "brandt",
      fullName: "Growth Team",
      companyName: "Brandt Digital Outreach",
      email: "offers@brandtdigital.example",
      preferredContact: "email",
    },

    // --- Individuals ---------------------------------------------------------
    { key: "priya", fullName: "Priya Raman", email: "priya.raman@example.com", phone: "(312) 555-0114", preferredContact: "text" },
    { key: "danielle", fullName: "Danielle Okafor", email: "danielle.okafor@example.com", phone: "(630) 555-0142", preferredContact: "text" },
    { key: "adaeze", fullName: "Adaeze Okoro", email: "adaeze.okoro@example.com", phone: "(312) 555-0118", preferredContact: "phone" },
    { key: "marcus", fullName: "Marcus Bell", email: "marcus.bell@example.net", phone: "(773) 555-0128", preferredContact: "text" },
    { key: "elena", fullName: "Elena Kovač", email: "elena.kovac@example.com", phone: "(847) 555-0136", preferredContact: "email" },
    { key: "chris", fullName: "Chris Delgado", email: "chris.delgado@example.com", phone: "(872) 555-0119", preferredContact: "phone" },
    { key: "jon_mercer", fullName: "Jon Mercer", email: "jon.mercer@example.com", phone: "(773) 555-0161", preferredContact: "email" },
    {
      key: "jonathan_mercer",
      fullName: "Jonathan Mercer",
      email: "jmercer@example.org",
      phone: "(773) 555-0161",
      preferredContact: "phone",
      confirmDuplicate: true,
    },
    { key: "sofia", fullName: "Sofia Lindqvist", email: "sofia.lindqvist@example.com", phone: "(847) 555-0153", preferredContact: "text" },
    { key: "aisha", fullName: "Aisha Khan", email: "aisha.khan@example.net", phone: "(630) 555-0166", preferredContact: "phone" },
    { key: "tyler", fullName: "Tyler Nguyen", email: "tyler.nguyen@example.com", phone: "(312) 555-0172", preferredContact: "phone" },
    { key: "hannah", fullName: "Hannah Moreau", email: "hannah.moreau@example.net", phone: "(773) 555-0178", preferredContact: "email" },
    { key: "ben", fullName: "Ben Carver", email: "ben.carver@example.com", phone: "(872) 555-0126", preferredContact: "email" },
    { key: "grace", fullName: "Grace Liu", email: "grace.liu@example.net", phone: "(630) 555-0158", preferredContact: "phone" },
    { key: "derek", fullName: "Derek Fontaine", email: "derek.fontaine@example.com", phone: "(312) 555-0133", preferredContact: "text" },
    { key: "paul", fullName: "Paul Jankowski", phone: "(847) 555-0162", preferredContact: "phone" },
    { key: "lucia", fullName: "Lucía Castellanos", email: "lucia.castellanos@example.com", phone: "(708) 555-0154", preferredContact: "text" },
    { key: "thomas", fullName: "Thomas Whitfield", phone: "(847) 555-0181", preferredContact: "phone" },
    { key: "natalie", fullName: "Natalie Brennan", email: "natalie.brennan@example.org", phone: "(331) 555-0112", preferredContact: "email" },
    { key: "ryan", fullName: "Ryan Castillo", email: "ryan.castillo@example.net", phone: "(331) 555-0124", preferredContact: "text" },
    { key: "kayla", fullName: "Kayla Brooks", email: "kayla.brooks@example.com", phone: "(773) 555-0102", preferredContact: "text" },
    { key: "brandon", fullName: "Brandon Hughes", email: "brandon.hughes@example.net", phone: "(773) 555-0109", preferredContact: "text" },
    { key: "omar", fullName: "Omar Haddad", email: "omar.haddad@example.com", phone: "(847) 555-0117", preferredContact: "phone" },
    { key: "isabella", fullName: "Isabella Romano", email: "isabella.romano@example.com", preferredContact: "email" },
    { key: "amara", fullName: "Amara Osei", email: "amara.osei@example.net", phone: "(708) 555-0138", preferredContact: "phone" },
    { key: "samuel", fullName: "Samuel Adeyemi", email: "samuel.adeyemi@example.org", phone: "(773) 555-0150", preferredContact: "email" },
    { key: "lauren", fullName: "Lauren Pierce", email: "lauren.pierce@example.com", phone: "(872) 555-0141", preferredContact: "text" },
    { key: "jasmine", fullName: "Jasmine Torres", email: "jasmine.torres@example.net", phone: "(773) 555-0196", preferredContact: "text" },
    { key: "gerald", fullName: "Gerald Novak", email: "gerald.novak@example.org", phone: "(630) 555-0107", preferredContact: "phone" },
    { key: "tasha", fullName: "Tasha Greene", email: "tasha.greene@example.com", phone: "(708) 555-0168", preferredContact: "email" },
    { key: "emily", fullName: "Emily Sandoval", email: "emily.sandoval@example.net", phone: "(847) 555-0174", preferredContact: "email" },
    { key: "dominic", fullName: "Dominic Reyes", email: "dominic.reyes@example.com", phone: "(773) 555-0139", preferredContact: "text" },
    { key: "megan", fullName: "Megan Hollis", email: "megan.hollis@example.org", phone: "(331) 555-0183", preferredContact: "email" },
    { key: "hector", fullName: "Hector Alvarez", email: "hector.alvarez@example.net", phone: "(773) 555-0145", preferredContact: "phone" },
  ];
}
