## Metadata
Dashboard Design Process Guidelines
A 10-Step Framework for Systematic Dashboard Design

---

## Process Overview

This framework encodes a senior designer's complete dashboard design process into 10 sequential, dependency-linked steps. Each step builds on the previous, ensuring every design decision is traceable back to user needs and business goals.

The system supports **2,400 unique dashboard configurations**: 4 functional types × 10 industry domains × 5 universal user goals × 12 business problems.

---

## Step 1 — Domain & Intent Discovery

**Purpose:** Extract foundational context from a problem statement.

**Process:**
- **Domain Identification:** Classify into one of 10 industry domains (Sales, Marketing, HR, Finance, Product, Support, Project Management, E-commerce, Healthcare, Operations) and identify the specific sub-domain niche (e.g., HR → Benefits Administration, HR → Recruiting Pipeline).
- **User Identification:** Define the primary user (daily user — job title, seniority, functional responsibilities), secondary users (managers, executives, cross-functional stakeholders), and user expertise level (data-literate analyst vs. operational staff needing simplified views).
- **Dashboard Type Classification:** Assign one of 4 functional types — Operational (real-time monitoring, immediate action), Tactical (short-term performance, team-level decisions), Strategic (long-term trends, executive-level), Analytical (exploration, root cause, hypothesis testing).
- **Business Problem Mapping:** Map to one of 12 standard problems — delayed decision-making from scattered data, missed SLAs, revenue leakage, poor resource allocation, compliance failures, customer churn signals, process bottlenecks, poor team visibility, forecasting inaccuracy, onboarding inefficiency, communication breakdown, manual reporting overhead.
- **User Goal Identification:** Assign one of 5 universal goals — status check, priority identification, progress tracking, root cause exploration, decision support.

---

## Step 2 — User Tasks

**Purpose:** Identify concrete tasks the dashboard must support, ranked by importance.

**Process:**
- Inventory every task the primary user performs that the dashboard should support.
- Rank each task by **frequency × criticality** — a task done daily with high business impact ranks highest.
- Distinguish between primary tasks (core job function), secondary tasks (supporting activities), and edge-case tasks (infrequent but important).
- Every task must trace back to the business problem and user goal from Step 1.

---

## Step 3 — Workflows

**Purpose:** Define how tasks chain together into complete user journeys.

**Process:**
- For each high-priority task cluster, define a complete workflow: trigger event → sequence of steps → decision points → completion state.
- Each workflow step defines: what the user needs to see, what decisions they make, what actions they take, and what happens next.
- Identify where workflows branch (decision points) and where they converge.
- Target 3 primary workflows — this is enough to cover the core use cases without overcomplicating the dashboard.

---

## Step 4 — Screen Architecture

> **This is the first critical design judgment step. Everything before this is analytical. From here forward, you are making design decisions.**

**Purpose:** Translate workflows into distinct screens and allocate information across them.

### 4.1 — When to Create a New Screen

A new screen is warranted when:
- The user's context shifts (overview → detail, monitoring → acting)
- Information density changes dramatically (summary KPIs → full data table)
- The task type changes (viewing → editing, browsing → creating)
- A decision point requires focused attention (user needs to evaluate before acting)

### 4.2 — Standard Screen Types

| Screen Type | Purpose | Typical Workflow Position |
|---|---|---|
| Overview / Home | Aggregated KPIs, alerts, entry points | Workflow start |
| List / Queue View | Scannable collection of items | After overview drill-down |
| Detail View | Full information about a single item | After list selection |
| Form / Input View | Data entry or editing | Mid-workflow action |
| Comparison View | Side-by-side evaluation | Decision support |
| Report / Export View | Formatted output for sharing | Workflow end |
| Settings / Configuration | User preferences, filters, saved views | Utility |

### 4.3 — Screen Definition Checklist

For each screen, define:
- **Screen name:** Clear, descriptive (e.g., "Claims Overview Dashboard", "Claim Detail Page")
- **Screen purpose:** One sentence. If you can't state it in one sentence, the screen is trying to do too much.
- **Primary workflow(s) served:** Which workflow steps this screen supports
- **Information inventory:** Every data element needed, derived from the "needs to see" column in Step 3
- **Primary actions:** What the user can do (view, filter, sort, select, edit, approve, export, navigate)
- **Entry points:** How the user arrives (direct nav, drill-down, notification link, search)
- **Exit points:** Where the user goes next (back to overview, forward to detail, lateral to related screen)

### 4.4 — Information Allocation Rules

This is where design judgment matters most. For each data element:

- **Which screen does it belong on?** A data point may appear on multiple screens at different levels of detail.
- **Is it primary or supporting?** Primary = needed to complete the task. Supporting = helpful context.
- **What level of detail?** Summary number on overview, full record on detail.

Rules of thumb:
- Overview screens: no more than 5–7 KPI groups
- List views: 4–6 columns of the most distinguishing attributes
- Detail views: comprehensive but organized into logical sections
- Every piece of information must trace back to a task from Step 2

### 4.5 — Screen Count Constraint

Target **3–5 screens** for a focused dashboard. If you have more, merge screens or drop the least critical workflow.

### 4.6 — Quality Checks

- Every workflow step from Step 3 is served by at least one screen
- Every screen has a single, clearly stated purpose
- No screen serves more than 2–3 workflow steps
- Information isn't duplicated unnecessarily across screens
- Entry and exit points create a coherent navigation flow

---

## Step 5 — Screen Grouping & Navigation

**Purpose:** Organize screens into a coherent navigation structure.

### 5.1 — Grouping by Workflow

- **Hub screens:** Starting points for multiple workflows (overview dashboard). Top of navigation hierarchy.
- **Workflow-specific screens:** Belong to a single workflow chain. Form linear sequences.
- **Utility screens:** Support all workflows (settings, search, help). Globally accessible.
- **Shared screens:** Used by multiple workflows (e.g., a detail view from different lists). Need consistent access regardless of entry point.

### 5.2 — Navigation Hierarchy

| Level | What It Contains | Examples |
|---|---|---|
| Level 0 — Global | Always visible. Primary hub + utility access. | App header, sidebar, global search |
| Level 1 — Primary Sections | Major areas, aligned with high-priority workflows | Top tabs or sidebar items |
| Level 2 — Sub-sections | Screens within a primary section | Drill-down views, tabs within a section |
| Level 3 — Detail/Action | Deepest level | Detail pages, forms, modals |

### 5.3 — Navigation Pattern Selection

| Screen Count | Relationship | Recommended Pattern |
|---|---|---|
| 2–4 primary sections | Parallel, equal weight | Top tab bar or sidebar |
| 5–7 primary sections | Parallel, mixed weight | Sidebar with collapsible groups |
| Linear workflow | Sequential | Breadcrumb trail + back navigation |
| Hub-and-spoke | Central entry, multiple paths | Dashboard with entry point cards |
| Deep hierarchy | Parent → child → grandchild | Left sidebar tree + breadcrumbs |

### 5.4 — Screen Flow Mapping

For each workflow, map the exact navigation path:

```
[Overview] ──click item──► [List View] ──click row──► [Detail View]
                                │                           │
                          filter/sort                  [Edit Modal]
                                │                           │
                          [Filtered List]              [Back to List]
```

For each transition, define: what triggers it (click, button, breadcrumb), what context carries over (filters, selections, scroll position), and whether the user can go back.

### 5.5 — URL/Route Structure

Clean URL patterns reflecting the hierarchy:

```
/dashboard                        → Overview (Hub)
/dashboard/claims                 → Claims list view
/dashboard/claims/:id             → Individual claim detail
/dashboard/claims/:id/edit        → Claim editing form
/dashboard/reports                → Reports section
/dashboard/settings               → Settings
```

---

## Step 6 — Sections & Components

> **This is the most design-intensive step. You are now composing the visual and functional structure of each screen.**

**Purpose:** Break each screen into sections, assign UI patterns, and specify components.

### 6.1 — Section Priority Framework (Zone System)

Every screen is organized into priority zones:

| Zone | Position | Content | Priority |
|---|---|---|---|
| ZONE 1 | Top / Left | Status + alerts — what needs attention NOW | Highest |
| ZONE 2 | Middle | Primary task area — what the user came to DO | High |
| ZONE 3 | Bottom / Right | Supporting info — context, trends, history | Medium |
| ZONE 4 | On-demand | Deep dives, settings, exports | Low (accessed via interaction) |

### 6.2 — Screen Pattern Mapping (Theresa Neil's 12 Patterns)

Map each screen to the appropriate pattern:

| Pattern | Use When | Screen Type |
|---|---|---|
| Dashboard | Aggregated KPIs with multiple entry points | Overview / Home |
| Filter/Dataset | Browsing and narrowing a collection | List / Queue |
| Forms | Data entry or editing | Form / Input |
| Master/Detail | List on one side, detail on other | Combined list + detail |
| Parallel Panels | Comparing related information side-by-side | Detail / Comparison |
| Wizard | Multi-step linear process | Complex form flows |
| Search Results | Displaying found items with context | Search pages |
| Settings | Configuration and preferences | Settings |

### 6.3 — Layout System

**Default to a 2-column grid layout for all content sections.** Full-width sections are only acceptable for the KPI row at top and data table/list views.

**Overview / Hub Screen:**

```
┌──────────────────┬──────────────────┐
│ KPI Card         │ KPI Card         │
├──────────────────┼──────────────────┤
│ KPI Card         │ KPI Card         │  ← KPI row (4 cards in 2×2 or 1×4)
├──────────────────┼──────────────────┤
│ Trend Chart      │ Distribution     │
│ (area/line)      │ Chart (donut/bar)│
│ ~250px height    │ ~250px height    │  ← Charts side-by-side, NEVER stacked
├──────────────────┼──────────────────┤
│ Alerts / Action  │ Rankings / Stats │
│ List (5 items    │ (top items by    │
│ + "View all →")  │ metric)          │  ← Lists/secondary content side-by-side
└──────────────────┴──────────────────┘
```

**Detail Screen — Header full-width, everything else 2-column:**

```
┌─────────────────────────────────────┐
│ ← Back / Breadcrumb                 │
│ [Icon] Title + ID    [Actions]      │
│        Status badge + metadata      │  ← Header is full width (exception)
├──────────────────┬──────────────────┤
│ Key Metrics      │ Chart            │
│ (stat cards)     │ (history/trend)  │  ← Info + chart side-by-side
├──────────────────┼──────────────────┤
│ Timeline /       │ Specifications / │
│ Activity Log     │ Key-value pairs  │  ← Timeline + details side-by-side
└──────────────────┴──────────────────┘
```

**List Screen — Filters and items full-width:**

```
┌─────────────────────────────────────┐
│ [Filter pills] [Search] [Sort]     │
├─────────────────────────────────────┤
│ [Card/Row list item]                │
│ [Card/Row list item]                │
│ [Card/Row list item]                │
│ ... Pagination / Load more          │
└─────────────────────────────────────┘
```

### 6.4 — Layout Rules

1. Overview screens: NEVER use full-width sections below the KPI row. Everything is 2-column.
2. Detail screens: Only the header/title area is full-width. All content sections are 2-column.
3. List screens: The list itself can be full-width (items need horizontal space).
4. Charts in 2-column layout: ~250px tall, not 400px. Keep compact.
5. Lists in 2-column layout: 4–5 items max with a "View all →" link.
6. Balance visual weight: if left column has a chart, right column should have a chart or list of similar height.

### 6.5 — Component Selection

**Data Display Components:**

| Component | Use When | Key Spec |
|---|---|---|
| Stat Card / KPI | Single metric with context | Value, label, trend indicator, comparison period |
| Data Table | Comparing many items across attributes | Column definitions, sort/filter, row actions |
| Line/Area Chart | Trend over time | Axes, time granularity, comparison lines |
| Bar Chart | Comparing categories | Axis labels, sort order, value labels |
| Donut/Pie Chart | Part-to-whole (≤6 segments) | Labels, percentages, center total |
| Heatmap | Pattern across two dimensions | Color scale, axis labels, cell values |
| Progress Bar | Completion toward a target | Current value, target, percentage |
| Status Badge | Categorical state | Color coding, label text |
| Timeline | Chronological events | Date, event description, actor |

**Form Components (Wroblewski principles):**

| Component | Use When | Key Spec |
|---|---|---|
| Text Input | Free-form short text | Label, placeholder, validation |
| Select / Dropdown | Choose from 4–15 options | Searchable if >7 options |
| Radio Buttons | Choose one from 2–5 options | Descriptions if options need explanation |
| Checkboxes | Choose multiple from a set | Select all option if applicable |
| Date Picker | Date selection | Calendar popup, range support |
| Toggle | Binary on/off | Label, current state indicator |

**Action Components:**

| Component | Use When | Key Spec |
|---|---|---|
| Primary Button | Main page action | Prominent color, verb + noun label |
| Secondary Button | Alternative action | Outlined or muted style |
| Icon Button | Frequent, recognizable action | Tooltip required |
| Bulk Action Bar | Acting on multiple selections | Appears on selection, shows count |

### 6.6 — Conditional Section Logic

Sections don't always need to be static. Define conditions:

| Condition Type | Rule | Example |
|---|---|---|
| Role-based | Show/hide based on user role | Admin sees config panel, viewer doesn't |
| State-based | Show/hide based on data state | Alerts section only when alerts exist |
| Progressive | Expand on interaction | Click to reveal details |
| Temporal | Show based on time context | End-of-month reporting sections |

---

## Step 7 — Interaction Patterns

**Purpose:** Define how every component responds to user input.

### 7.1 — Global Interactions (apply to all screens)

- **Filtering:** What filter controls exist, how they affect displayed data, persistent vs. temporary
- **Sorting:** Which columns/attributes are sortable, default sort order
- **Search:** Global search scope, inline search within lists
- **Refresh:** Auto-refresh interval (for operational dashboards), manual refresh trigger
- **Notifications:** How alerts surface, what's dismissible vs. persistent

### 7.2 — Screen-Level Interactions

For each screen, define:
- **Hover states:** What additional info appears on hover (tooltips, previews)
- **Click actions:** What happens on click for each interactive element
- **Selection behavior:** Single vs. multi-select, what selection enables
- **Drill-down paths:** What clicking a data point reveals (detail modal, new screen, inline expansion)
- **Inline editing:** Which fields are editable in place vs. requiring a form view

---

## Step 8 — States & Closure

**Purpose:** Design for every state each component can be in, and define how workflows conclude.

### 8.1 — Component States

Every component needs 4 states designed:

| State | What It Shows | Design Consideration |
|---|---|---|
| Loading | Skeleton or spinner | Match the component's shape, avoid layout shift |
| Empty | No data available | Explain why + suggest action ("No claims yet. Import data →") |
| Error | Something failed | Explain what happened + how to fix it |
| Success | Action completed | Confirmation + next step suggestion |

### 8.2 — Workflow Closure

For each workflow, define what happens when the user completes it:
- What confirmation do they see?
- Where are they directed next?
- What changes in the dashboard state?
- How does the overview reflect the completed action?

---

## Step 9 — Design Overview & Traceability

**Purpose:** Consolidate the full spec and verify traceability.

### 9.1 — Traceability Matrix

Every component must trace back through the full chain:

```
Component → Section → Screen → Workflow Step → Task → User Goal → Business Problem
```

If any component can't complete this chain, it shouldn't exist in the dashboard.

### 9.2 — Consolidation Checklist

- All screens documented with sections, components, interactions, and states
- Navigation flow is complete and bidirectional
- No orphan components (everything traces to a task)
- No missing states (every component has loading/empty/error/success)
- Information architecture is consistent (same data appears at same detail level across screens)

---

## Step 10 — Prototype Generation

**Purpose:** Generate an interactive React/HTML prototype from the complete specification.

### 10.1 — Generation Rules

- Build from the spec in Steps 4–9 — every screen, section, and component is already defined
- Use realistic sample data that matches the domain from Step 1
- Implement the navigation flow from Step 5
- Include the interaction patterns from Step 7
- Show at least one non-default state from Step 8 (e.g., an alert state, an empty state)

### 10.2 — Output Quality Markers

- Dashboard loads with a clear visual hierarchy matching the zone system
- Navigation between screens works as specified
- KPIs show realistic numbers with appropriate formatting
- Charts display meaningful data patterns
- Lists are populated with domain-relevant sample records
- Color system is cohesive and accessibility-compliant

---

## Decision-Making Summary

### The 3 Hardest Design Decisions in This Process

1. **Screen Boundaries (Step 4):** When does a new screen start vs. when is it a section within an existing screen? The answer is context shift + information density change. If the user needs to mentally "reset" what they're looking at, it's a new screen.

2. **Section Composition (Step 6):** What goes in Zone 1 vs. Zone 2 vs. Zone 3? The answer is: Zone 1 is what interrupts the user's default task (alerts, anomalies). Zone 2 is the default task itself. Zone 3 is "nice to know" context that supports but doesn't drive the task.

3. **Information Allocation (Step 4.3):** The same data point might appear on 3 different screens at different detail levels. Overview shows the count. List shows the summary. Detail shows the full record. Getting this progressive disclosure right is what separates a usable dashboard from an overwhelming one.

### The Golden Rule

Every design decision traces back: Component → Section → Screen → Workflow → Task → User Goal → Business Problem. If you can't complete the chain, the component doesn't belong.
