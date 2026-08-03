# Microsoft Copilot Quiz

A small, self-contained quiz web app for the two-day **Microsoft Copilot (Beginner to
Intermediate)** course. It has nine modules with six questions each (54 total). Everything is
pure static HTML, CSS, and vanilla JavaScript — no build step, no framework, no server. It is
designed to run directly from GitHub Pages.

All question content is sourced from **[Microsoft Learn](https://learn.microsoft.com)**, and
every question links back to the exact Learn page it came from.

## Live site

- **All quizzes:** `https://roohiraheem2.github.io/copilot-quiz/`
- **A single module directly:** add `?m=<number>`, e.g. `…/copilot-quiz/?m=3` opens the
  Prompt Engineering quiz. See `quiz-links.txt` for the full list.

No sign-in is required for anyone — it is a public, static page. The name you type is kept in a
JavaScript variable for the duration of the quiz only; it is never stored, cookied, or sent
anywhere.

## Project layout

```
index.html            The whole UI (landing, name entry, quiz, result screens)
style.css             All styling (light theme, responsive, reduced-motion aware)
app.js                All logic (routing, grading, result, image export)
quiz-links.txt        The main link plus a direct link for each module
data/
  modules.json        The manifest: the list of modules shown on the landing page
  module1.json …      One file per module, holding that module's questions
  module9.json
```

The only external dependency is **html2canvas** (loaded from a CDN), used solely to render the
result card as a downloadable PNG.

---

## Adding or editing questions (no JavaScript required)

You only ever touch JSON. There are two kinds of file: the **manifest** and the **module files**.

### 1. The manifest — `data/modules.json`

This drives the landing-page grid and tells the app where to find each module's questions.

```json
{
  "course": "Microsoft Copilot",
  "subtitle": "Beginner to Intermediate",
  "questionsPerModule": 6,
  "modules": [
    { "number": 1, "title": "Generative AI & Copilot Foundations", "icon": "🧠", "file": "data/module1.json", "count": 6 }
  ]
}
```

Each entry in `modules`:

| Field    | Meaning                                                          |
|----------|-----------------------------------------------------------------|
| `number` | Module number (used in the card, the URL `?m=`, and file names) |
| `title`  | Shown on the card and throughout the quiz                       |
| `icon`   | The emoji shown on the card and in results                      |
| `file`   | Path to that module's question file                             |
| `count`  | Number of questions, shown as "6 questions" on the card         |

**To add a whole new module:** create `data/module10.json` (see the schema below) and add one
new object to the `modules` array. That is it — no code changes.

### 2. A module file — `data/module<N>.json`

```json
{
  "module": 1,
  "title": "Generative AI & Copilot Foundations",
  "icon": "🧠",
  "questions": [
    {
      "id": "m1q1",
      "type": "single",
      "question": "In a large language model, what is a \"token\"?",
      "options": ["...", "...", "...", "..."],
      "correct": [0],
      "explanation": "Why the right answer is right (and, where useful, why a tempting wrong answer is wrong).",
      "source": "https://learn.microsoft.com/en-us/..."
    }
  ]
}
```

#### Question fields

| Field         | Required | Notes                                                                              |
|---------------|----------|------------------------------------------------------------------------------------|
| `id`          | yes      | Any unique string, e.g. `m1q1`.                                                     |
| `type`        | yes      | One of `single`, `multi`, `truefalse`.                                              |
| `question`    | yes      | The question text. **No emojis in content.**                                       |
| `options`     | yes      | Array of answer strings. For `truefalse` it must be exactly `["True", "False"]`.   |
| `correct`     | yes      | Array of **zero-based** indices into `options` (see below).                         |
| `explanation` | yes      | 1–2 plain-language sentences shown after answering and in the review.              |
| `source`      | yes      | The Microsoft Learn URL the content came from. Verify it resolves before adding.    |

#### Question types

- **`single`** — one correct answer, usually 4 options. `correct` has exactly **one** index.
  Clicking an option submits immediately.
- **`multi`** — two or more correct answers, 4–5 options. `correct` has **two or more** indices.
  Shows checkboxes and a Submit button, and is labelled "Select all that apply".
- **`truefalse`** — `options` is exactly `["True", "False"]`; `correct` is `[0]` for True or
  `[1]` for False.

#### How `correct` works

`correct` is always an array of zero-based positions in `options`.

```
options: ["Apple", "Banana", "Cherry", "Date"]
correct: [2]          -> "Cherry" is the single right answer
correct: [0, 2]       -> "Apple" and "Cherry" are both right (a multi question)
```

### Content rules used for this quiz

- Source everything from `learn.microsoft.com`, and put the exact page URL in `source`.
- Keep questions beginner-to-intermediate and practical — no trivia about button positions,
  licensing SKUs, or version numbers.
- **No emojis inside `question`, `options`, or `explanation`.** Emojis live only in the UI
  (headings, buttons, badges, the module `icon`).

### Validate your edits

A quick sanity check that every module has the right shape:

```bash
node -e '
const fs=require("fs");
const man=JSON.parse(fs.readFileSync("data/modules.json"));
let total=0;
man.modules.forEach(m=>{
  const q=JSON.parse(fs.readFileSync(m.file));
  q.questions.forEach(x=>{ total++;
    x.correct.forEach(i=>{ if(i<0||i>=x.options.length) throw new Error(x.id+": correct index out of range"); });
    if(x.type==="truefalse" && JSON.stringify(x.options)!==JSON.stringify(["True","False"])) throw new Error(x.id+": truefalse options must be [\"True\",\"False\"]");
  });
});
console.log("OK -", total, "questions");
'
```

---

## Running locally

Because the app loads JSON with `fetch`, open it through a local web server (not `file://`):

```bash
python3 -m http.server 8099
# then visit http://localhost:8099/
```

## Deploying to GitHub Pages

The site is plain static files at the repository root, so GitHub Pages serves it as-is
(a `.nojekyll` file is included so Pages skips Jekyll processing). Enable Pages for the
repository with the branch as the source and the root (`/`) folder, and the site is live at
`https://<owner>.github.io/copilot-quiz/`.

## Accessibility & design notes

- Semantic HTML, keyboard navigable, visible focus states, and an `aria-live` reaction badge so
  screen readers announce correct/incorrect.
- Colour is never the only signal — a ✅ / ❌ mark and a text label accompany every state.
- All animations are short and easing-based, and are disabled (along with confetti) under
  `prefers-reduced-motion: reduce`.
- Fully responsive with tap targets of at least 44px; verified with no horizontal overflow at
  375px wide.

> This is a practice quiz for learning. It is not affiliated with or endorsed by Microsoft, and
> uses no Microsoft logos or trademarked assets.
