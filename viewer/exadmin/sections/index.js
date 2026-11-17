import { examplesSection } from "./examples.js";
import { historySection } from "./history.js";
import { modelsSection } from "./models.js";
import { reportsSection } from "./reports.js";
import { statsSection } from "./stats.js";
import { usersSection } from "./users.js";

// The admin pages' sections, in navigation order. A section is
// { id, label(), mount(container, { me }) }: `id` is its address
// (/exadmin/#<id>), mount() builds it into the emptied main area each time
// it is opened. A new one is added here and nowhere else. An optional
// badge(summary) puts a counter next to its name (main.js, GET
// /api/admin/summary).
export const SECTIONS = [usersSection, modelsSection, statsSection, reportsSection, historySection, examplesSection];
