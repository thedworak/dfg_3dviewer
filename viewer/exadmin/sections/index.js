import { reportsSection } from "./reports.js";
import { usersSection } from "./users.js";

// The admin pages' sections, in navigation order. A section is
// { id, label(), mount(container, { me }) }: `id` is its address
// (/exadmin/#<id>), mount() builds it into the emptied main area each time
// it is opened. A new one is added here and nowhere else.
export const SECTIONS = [usersSection, reportsSection];
