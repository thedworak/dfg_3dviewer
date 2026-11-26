# Live data

A table drives the model. Each row of a table belongs to a part of the model,
and the row's cells decide how the part looks: its colour, a label above it,
an alert, whether it is shown. The table stays connected. When it changes -
at its URL, in its file, in the viewer's window, or pushed by the page - the
model moves to its new look: colours blend, numbers count up or down and the
changed parts flash. Neither the model nor the page is loaded again.

What it is for:

- **monitoring**: moisture, temperature or crack widths measured on a
  building, read from the logger's CSV every few seconds;
- **conservation**: the condition of each part, kept in a spreadsheet by the
  people who inspect it;
- **presentations**: a table on one side, the model on the other - change a
  number and the audience sees where it is.

The example *Tempietto - live data: a table drives the model* in the example
list shows moisture readings on the stone
(`viewer/manifesto/examples/tempietto-aim3d-live-data.json`,
`viewer/examples/tempietto/data/monitoring.csv`). With the viewer run locally,
change a number in the CSV file and save it: within two seconds the model
follows.

## The table

One row for each part, with the column names in the first line:

```csv
part,moisture,condition,inspected
Step_1,31.5,poor,2026-10-28
Column_1,9.5,good,2026-11-05
Wall_Back,26.5,fair,2026-11-03
```

- **CSV or TSV**: separated by commas, semicolons or tabs (found from the
  first line). A decimal comma is read (`9,5`), and so are units after a
  number (`23 %`).
- **JSON**: an array of objects (`[{ "part": "Step_1", "moisture": 31.5 }]`),
  `{ "rows": [...] }`, or an object of objects keyed by the part's name.

A row finds its part by name. One column - the **key** - holds the name of an
object in the model, as the Hierarchy window lists it. Names are compared
without case, spaces and punctuation, so `Column_1`, `column 1` and
`Column.1` are the same part. For an IFC model the key can also be an
element's `GlobalId`. A row that names a group paints everything in it; a
row that names one of the group's objects wins there. Rows that name nothing
in the model are greyed in the window, and the window says how many were
found.

At most 5000 rows are read; the window lists the first 300.

## Where the table comes from

**Analysis > Live data** opens the window.

| Source | How it stays live |
| --- | --- |
| A URL | Read again every 1, 2, 5, 15 or 60 seconds (any number of seconds in a manifest). An unchanged answer changes nothing. Not read while the page is in a background tab |
| A file from the device | In Chrome and Edge the file stays connected (File System Access API): save it in the spreadsheet or the editor and the model follows within a second. Other browsers read it once |
| The window's own table | A cell changed there changes the model at once. Arrow up and down nudge a number by 1, with Shift by 10 |
| The model | **Generate from the model** writes a table to fill in: a row for each named part, as the Hierarchy lists them (without the root that holds them all), with the columns `part`, `value` and `note`. A table already open keeps its rows and columns and gets the parts it does not name yet. The table is then the window's own; **Save as CSV** keeps it |
| The page | `Viewer.updateLiveDataRow(key, values)`, `Viewer.setLiveDataRows(rows)`, or a message to an embedded viewer (below) |

A URL on another site needs that site's permission to be read from a page
(CORS). A Google Sheet works when published to the web as CSV
(*File > Share > Publish to web*); such a link is refreshed by Google every
few minutes, not at once.

## What the columns do

| Setting | What it does |
| --- | --- |
| Part's name in | The key column. The viewer picks the column that names most objects |
| Colour from | A numeric column runs along a colour ramp, from the lowest value to the highest (or between the two ends given). A text column gets one colour for each value. A cell that is itself a colour (`#c0392b`) is used as it is |
| Label from | The cell is shown above the part, with a unit after it |
| Alert from | The part pulses while its number is below or above a limit, or while its text says a given word |
| Shown when | The part is hidden while its cell says `0`, `false`, `no` or `off` |
| Colour strength | How much of the colour covers the part's own material |

A table without settings is coloured by its first numeric column.

The colours are overlays on the model: the model's own materials are not
changed, and switching the data off shows it as it was. The ramps are `heat`,
`viridis`, `blue`, `green`, `traffic` and `diverging`; the colours for text
values are told apart with the common colour vision deficiencies too. Colour
is never the only sign: the label gives the value and the legend its range.

## In a manifest

The settings are kept as `AIM3DViewer.data`
([schema](../viewer/manifesto/AIM3DViewer-schema.md)), from manifest format
1.3:

```json
"data": {
  "src": "./examples/tempietto/data/monitoring.csv",
  "refresh": 2,
  "key": "part",
  "color": { "column": "moisture", "ramp": "heat", "min": 5, "max": 35 },
  "label": { "column": "moisture", "unit": "%" },
  "alert": { "column": "moisture", "above": 28 }
}
```

A table with a URL is saved as the URL. A table from a file, from the window
or pushed by the page has no address, so its rows are saved in the manifest
(`rows`).

## From a page

```js
// One reading arrives (a sensor feed, a websocket, a form):
Viewer.updateLiveDataRow("Column_1", { moisture: 31 });

// A whole new table:
Viewer.setLiveDataRows([{ part: "Column_1", moisture: 31 }, { part: "Step_1", moisture: 12 }]);

// The settings and the table together, as in a manifest:
Viewer.setLiveData({ src: "https://example.org/readings.csv", refresh: 5, color: "moisture" });
```

A page that embeds the viewer in a frame posts the same to it. The viewer
reads such messages only when the scene already has live data:

```js
frame.contentWindow.postMessage({ type: "aim3d-data", key: "Column_1", values: { moisture: 31 } }, "*");
frame.contentWindow.postMessage({ type: "aim3d-data", rows: [...] }, "*");
```

## Limits

- The 4D timeline and reconstruction variants also show and hide parts. A
  part the table hides stays hidden whatever the year.
- Point clouds, Gaussian splats and volumes have no named parts to paint.
- Labels are drawn over the model and may overlap where many parts are close
  together.

The code is `viewer/editor/live-data.js` (the model and the window) and
`viewer/live-data-table.js` (reading, comparing and colouring tables, without
the DOM); see [`viewer/FUNCTIONS.md`](../viewer/FUNCTIONS.md).
