# Google Analytics 4 Setup Checklist

Your measurement ID `G-0WZPGD170G` is already wired into the app. This doc covers what to do **inside the GA4 dashboard** to actually get value out of the tracking — marking conversions, building funnels, registering custom dimensions, etc.

All of this is one-time setup. You can safely ignore it until you have real traffic.

---

## 0. Verify data is flowing

1. Go to [analytics.google.com](https://analytics.google.com) → pick the InferScope property
2. Left sidebar → **Reports → Realtime**
3. Open the deployed app (or localhost) in another tab, accept the cookie banner, click around
4. Within ~30s you should see:
   - **Users in last 30 minutes: 1**
   - Events: `page_view`, `tab_switch`, `theme_toggle`, etc.

If nothing appears after a minute: check the consent banner was accepted (not declined) and that no ad blocker is running.

---

## 1. Mark key events as conversions

In GA4, "key events" (formerly "conversions") get priority in every report.

**Admin** (bottom-left gear icon) → **Events** → flip the **"Mark as key event"** toggle for:

| Event | Why it's a key event |
|-------|----------------------|
| `calculate_from_arena` | User went from browsing → estimating cost. Core funnel completion. |
| `advisor_message_sent` | User engaged deeply with the AI advisor. |
| `compare_open` | User compared multiple models (power-user behavior). |
| `tour_chapter_complete` | User finished onboarding — proxy for "they understood the product." |
| `provider_estimate_cost` | User clicked into Infra Explorer workflow. |

> Events only appear in this list after they've fired at least once. Visit the app and trigger each event first if you don't see them yet.

---

## 2. Register custom parameters as dimensions

GA4 tracks the params you send (`model_name`, `tab_name`, `chapter`, etc.) but you can't use them in reports until you register them as custom dimensions.

**Admin → Custom definitions → Create custom dimension** — create one for each:

| Dimension name | Event parameter | Scope |
|----------------|-----------------|-------|
| Tab name | `tab_name` | Event |
| Model name | `model_name` | Event |
| Model ID | `model_id` | Event |
| Source | `source` | Event |
| Filter type | `filter_type` | Event |
| Filter value | `value` | Event |
| Insight view | `view` | Event |
| Scenario | `scenario` | Event |
| Provider | `provider` | Event |
| Question | `question` | Event |
| Chapter | `chapter` | Event |
| Tour source | `source` (for tour events) | Event |
| Theme mode | `mode` | Event |

> Custom dimensions take **~24h** to start populating historical reports, but real-time tracking works immediately.

---

## 3. Build the core funnel exploration

Shows where users drop off in your main workflow.

1. Left sidebar → **Explore** (telescope icon) → **+ New exploration** → **Funnel exploration**
2. Configure **Steps**:
   - **Step 1** → Event = `page_view`
   - **Step 2** → Event = `tab_switch` with param filter `tab_name = Cost Calculator`
   - **Step 3** → Event = `calculate_from_arena`
   - **Step 4** → Event = `advisor_open`
3. Save as **"Arena → Calculator → Advisor funnel"**

Now you can see: of 100 visitors, how many open the calculator? Of those, how many estimate a cost? How many then ask the AI? Drop-off points = UX friction.

---

## 4. Build an engagement dashboard

1. **Explore → + New exploration → Free form**
2. Drag into **Dimensions** (left panel):
   - `Event name`
   - `Page location`
   - `Device category`
3. Drag into **Values**:
   - `Event count`
   - `Active users`
   - `Engaged sessions`
4. In the filter area, exclude noise events (`page_view`, `session_start`, `first_visit`) so only custom events show.
5. Save as **"InferScope engagement"**

This answers: which features get used most, tab switches per user, average advisor messages per engaged user.

---

## 5. Specific reports worth building

### "Which models do people calculate costs for?"
- Dimension: `model_name` (needs Step 2 registration)
- Metric: Event count
- Filter: Event name = `calculate_from_arena`

### "Tour completion vs. drop-off by chapter"
- Rows: `chapter` dimension
- Columns: `Event name` (filter to tour events)
- Values: Event count
- Compare `tour_chapter_complete` vs `tour_chapter_skip` ratios to see which chapter loses people

### "Which suggested advisor questions get clicked most?"
- Dimension: `question`
- Metric: Event count
- Filter: Event name = `advisor_suggested_click`

### "Most popular focus task filter"
- Dimension: `value` (the filter value)
- Metric: Event count
- Filter: Event name = `filter_apply` AND `filter_type = focus_task`

---

## 6. Enable free-tier goodies

**Admin → Data collection and modification:**

- **Google signals** — toggle ON. Adds demographic data (age, gender, interests) for signed-in users. Free.
- **Enhanced measurement** — should already be on. Auto-tracks scrolls, outbound clicks, file downloads, site search.

---

## 7. Deploy to production (when ready)

On Vercel → **Project Settings → Environment Variables → Production scope**, add:

```
VITE_GA_MEASUREMENT_ID = G-0WZPGD170G
GROQ_API_KEY = <your Groq key>
```

Redeploy. Real visitors show up in Realtime within ~30s of their first interaction.

---

## 8. What to watch weekly (first month)

Three numbers matter most for a portfolio project:

1. **Users in last 30 minutes** (Realtime) — is anyone visiting?
2. **Top events by count** (Engagement → Events) — what are people actually doing? If 80% is `page_view` with little else → people bounce without engaging.
3. **Key events / conversions** (Reports → Engagement → Conversions) — is anyone completing the full workflow?

---

## Quick reference: all events tracked by the app

| Event | Params | Fires when |
|-------|--------|------------|
| `page_view` | (automatic) | Any route load |
| `tab_switch` | `tab_name` | User clicks a top nav tab |
| `theme_toggle` | `mode` | User flips dark/light mode |
| `model_select` | `model_id`, `model_name`, `source` | User clicks CALCULATE on an Arena row, or "USE THIS MODEL" on a Workload Recommendation card. `source` distinguishes the path (`arena_table_calculate`, `workload_recommendation`) |
| `filter_apply` | `filter_type`, `value` | User changes provider/license/focus-task filter. Also fires with `filter_type: 'csv_export'` and `value: <row count>` when the user exports the filtered table |
| `compare_open` | `model_count` | User opens the model compare drawer |
| `arena_insight_view` | `view` | User switches ELO/Price/Context/Value view |
| `calculate_from_arena` | `model_name` | User goes from Arena → Calculator via CALCULATE button |
| `calculator_scenario_change` | `scenario` | User toggles Low/Base/High/Spike traffic profile |
| `provider_estimate_cost` | `provider` | User clicks ESTIMATE COST on a provider card |
| `gpu_compare_open` | `gpu_count` | User opens the GPU compare drawer |
| `external_link_click` | `url`, `context` | User clicks an outbound link (e.g. provider homepage `open_in_new` icon) |
| `advisor_open` | — | User opens the AI Advisor panel |
| `advisor_message_sent` | `message_length` | User types + sends a custom question |
| `advisor_suggested_click` | `question` | User clicks a pre-written suggestion chip |
| `tour_chapter_start` | `chapter`, `source` (auto/manual) | A tour chapter begins |
| `tour_chapter_complete` | `chapter` | User finishes all steps of a chapter |
| `tour_chapter_skip` | `chapter`, `step_index` | User dismisses mid-chapter |
