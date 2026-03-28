# `.eng` Language Specification v1.0

> **English as a Programming Language**
> A structured natural language that compiles to any framework via LLM-powered code generation.

---

## Table of Contents

1. [Philosophy & Design Principles](#1-philosophy--design-principles)
2. [File Structure](#2-file-structure)
3. [Frontmatter Schema](#3-frontmatter-schema)
4. [Keywords Reference](#4-keywords-reference)
5. [Variables & Expressions](#5-variables--expressions)
6. [Components](#6-components)
7. [Layouts & Slots](#7-layouts--slots)
8. [Imports & Composition](#8-imports--composition)
9. [Control Flow](#9-control-flow)
10. [Data Binding & Props](#10-data-binding--props)
11. [Events & Interactions](#11-events--interactions)
12. [Forms & Inputs](#12-forms--inputs)
13. [Styling Directives](#13-styling-directives)
14. [State Management](#14-state-management)
15. [Data Fetching](#15-data-fetching)
16. [Routing & Navigation](#16-routing--navigation)
17. [Modals, Overlays & Toasts](#17-modals-overlays--toasts)
18. [Animations & Transitions](#18-animations--transitions)
19. [Comments & Documentation](#19-comments--documentation)
20. [Project Structure & Configuration](#20-project-structure--configuration)
21. [Compilation Targets](#21-compilation-targets)
22. [Complete Examples](#22-complete-examples)
23. [Edge Cases & Rules](#23-edge-cases--rules)
24. [Reserved Keywords](#24-reserved-keywords)
25. [Error Handling](#25-error-handling)
26. [Accessibility](#26-accessibility)
27. [Future Considerations](#27-future-considerations)

---

## 1. Philosophy & Design Principles

### Core Philosophy

`.eng` is not pseudocode. It is a **deterministic, parseable, structured natural language** that describes application interfaces and behavior. It sits between freeform English prompting and actual source code.

### Design Principles

- **Readable by anyone** — A non-developer should understand what a `.eng` file does by reading it.
- **Parseable by machines** — Every `.eng` file produces a deterministic JSON AST. Same file → same AST, every time.
- **Framework-agnostic** — The same `.eng` source compiles to Laravel Blade, React, Vue, Svelte, Angular, plain HTML, or any target.
- **Composable** — Files import files. Components nest. Layouts extend. Just like real code.
- **Progressive complexity** — A simple static page is 5 lines. A complex interactive dashboard is 200 lines. The language scales without changing paradigms.
- **Explicit over magic** — Every behavior is declared, not inferred. The LLM compiler receives structured intent, not ambiguous prose.

### What `.eng` Is NOT

- Not a prompt — it has grammar, structure, and rules.
- Not a framework — it compiles TO frameworks.
- Not a templating engine — it's a full view/interaction description language.
- Not Turing-complete — it describes UIs and their behavior, not arbitrary computation.

---

## 2. File Structure

Every `.eng` file follows this structure:

```
--- (frontmatter) ---

[imports]

[body: keywords, content, nesting]
```

### Rules

- File extension: `.eng`
- Encoding: UTF-8
- Indentation: **2 spaces** (meaningful — defines nesting/scope)
- Maximum nesting depth: **6 levels**
- One component/page/layout per file
- Blank lines are ignored (used for readability)
- Lines are trimmed of trailing whitespace

---

## 3. Frontmatter Schema

Every `.eng` file begins with a YAML frontmatter block enclosed in `---` delimiters.

```yaml
---
type: component | page | layout | fragment | modal
name: PascalCaseName
description: "Human-readable purpose of this file"
props:
  - name: propName
    type: string | number | boolean | array | object | image | date | any
    required: true | false
    default: "default value"
extends: "path/to/layout.eng"
route: "/url-path"
route: "/url-path/:paramName"
title: "Page Title — for pages only"
auth: required | guest | any
role: admin | editor | user
tags: [searchable, metadata, tags]
---
```

### Frontmatter Fields

| Field | Required | Applies To | Description |
|-------|----------|------------|-------------|
| `type` | Yes | All | What this file represents |
| `name` | Yes | All | PascalCase identifier |
| `description` | No | All | Human-readable purpose |
| `props` | No | component, fragment | Input properties with types |
| `extends` | No | page | Which layout this page uses |
| `route` | No | page | URL path (supports `:param` dynamic segments) |
| `title` | No | page | Browser/document title |
| `auth` | No | page | Authentication requirement |
| `role` | No | page | Authorization role required |
| `tags` | No | All | Metadata tags for organization |

### Type Definitions

| Type | What It Represents |
|------|-------------------|
| `component` | Reusable UI building block (button, card, navbar) |
| `page` | Full routable page (extends a layout) |
| `layout` | Structural wrapper with slots (header/footer/sidebar) |
| `fragment` | Partial template (not standalone, always embedded) |
| `modal` | Overlay/dialog component |

---

## 4. Keywords Reference

Keywords are **capitalized** to distinguish them from natural language descriptions. Keywords must appear at the **start of a line** (after indentation).

### Structure Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Import` | Bring in another `.eng` file | `Import header from "header.eng"` |
| `Place` | Position an imported component | `Place {header} at the top` |
| `Slot` | Define a fillable area in layouts | `Slot {main} here` |
| `Fill` | Provide content for a slot | `Fill {main}:` |
| `Create` | Define a UI container/element | `Create a card container:` |
| `Show` | Display content/data | `Show {title} as a heading` |
| `Group` | Wrap multiple elements together | `Group these as a flex row:` |

### Control Flow Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Loop` | Iterate over a collection | `Loop over {posts} as {post}:` |
| `If` | Conditional rendering | `If {user} is logged in:` |
| `Else If` | Secondary condition | `Else If {user} is admin:` |
| `Else` | Fallback branch | `Else:` |
| `Switch` | Multi-branch matching | `Switch {status}:` |
| `Case` | Branch within switch | `Case "active":` |
| `Default` | Default switch branch | `Default:` |

### Data Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Set` | Declare local state/variable | `Set {count} to 0` |
| `Bind` | Two-way data binding | `Bind {searchQuery} to this input` |
| `Fetch` | Retrieve remote data | `Fetch {posts} from "/api/posts"` |
| `Compute` | Derived/computed value | `Compute {fullName} from {first} and {last}` |
| `Store` | Global state declaration | `Store {cartItems} as shared state` |
| `Update` | Modify state | `Update {count} by adding 1` |

### Interaction Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `On` | Event handler | `On click:` |
| `Navigate` | Route change | `Navigate to "/dashboard"` |
| `Submit` | Form submission | `Submit {form} to "/api/register"` |
| `Emit` | Custom event emission | `Emit "item-added" with {item}` |
| `Toggle` | Boolean state flip | `Toggle {isOpen}` |
| `Open` | Open a modal/overlay | `Open {confirmDialog}` |
| `Close` | Close a modal/overlay | `Close {confirmDialog}` |
| `Prevent` | Prevent default behavior | `Prevent default` |

### Display Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Show` | Render content | `Show {name} as bold text` |
| `Hide` | Conditionally hide | `Hide {element} when {condition}` |
| `List` | Render a list | `List {items} as bullet points` |
| `Table` | Render tabular data | `Table {users} with columns: name, email, role` |
| `Image` | Display an image | `Image {user.avatar} with alt "Profile photo"` |
| `Link` | Create a hyperlink | `Link to {post.url} showing {post.title}` |
| `Icon` | Display an icon | `Icon "search" size small` |
| `Markdown` | Render markdown content | `Markdown {post.body}` |

### Form Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Input` | Text/number input | `Input for {email} type email, required` |
| `Textarea` | Multi-line text | `Textarea for {bio} rows 4` |
| `Select` | Dropdown | `Select {country} from {countries}` |
| `Checkbox` | Boolean toggle | `Checkbox for {agreeToTerms} label "I agree"` |
| `Radio` | Single choice from group | `Radio {plan} options ["free", "pro", "enterprise"]` |
| `Upload` | File upload | `Upload {avatar} accept images only` |
| `DatePicker` | Date selection | `DatePicker for {startDate}` |

### Styling Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Style` | Apply inline/scoped styles | `Style this with padding large, background light gray` |
| `Theme` | Reference theme tokens | `Theme color primary` |
| `Responsive` | Breakpoint-specific behavior | `Responsive on mobile: stack vertically` |
| `Animate` | Attach animation | `Animate with fade-in on appear` |

### Utility Keywords

| Keyword | Purpose | Example |
|---------|---------|---------|
| `Debug` | Development-only output | `Debug {currentState}` |
| `Comment` | Inline documentation | `Comment: This section handles auth` |
| `TODO` | Mark incomplete sections | `TODO: Add pagination here` |
| `Include` | Embed raw content/HTML | `Include raw HTML from "banner.html"` |

---

## 5. Variables & Expressions

### Variable Syntax

All dynamic values are wrapped in `{curlyBraces}`.

```
{variableName}           -- simple variable
{user.name}              -- dot notation for nested access
{post.author.avatar}     -- deep nesting
{items[0]}               -- array index access
{items.length}           -- property access
{items.count}            -- alias for length/count
```

### String Literals

Double quotes for literal text:

```
Show "Welcome to our site" as a heading
```

### Expressions in Conditions

`.eng` supports natural language conditions that the parser maps to operators:

```
If {count} is greater than 0:
If {user} is logged in:
If {status} equals "active":
If {items} is empty:
If {items} is not empty:
If {age} is between 18 and 65:
If {role} is one of ["admin", "editor"]:
If {name} contains "john":
If {email} is valid email:
If {date} is before {deadline}:
If {date} is after today:
If {price} is at least 100:
If {price} is at most 1000:
```

### Condition Operator Mapping

| Natural Language | Operator | Example |
|-----------------|----------|---------|
| `is` / `equals` | `==` | `{x} is 5` |
| `is not` / `does not equal` | `!=` | `{x} is not 5` |
| `is greater than` / `is more than` | `>` | `{x} is greater than 10` |
| `is less than` / `is fewer than` | `<` | `{x} is less than 10` |
| `is at least` | `>=` | `{x} is at least 5` |
| `is at most` | `<=` | `{x} is at most 5` |
| `is between X and Y` | `>= && <=` | `{x} is between 1 and 10` |
| `is empty` | `empty()` | `{list} is empty` |
| `is not empty` / `has items` | `!empty()` | `{list} is not empty` |
| `contains` | `includes()` | `{str} contains "hello"` |
| `starts with` | `startsWith()` | `{str} starts with "Dr"` |
| `ends with` | `endsWith()` | `{str} ends with ".com"` |
| `is one of [...]` | `in` | `{x} is one of ["a","b"]` |
| `is not one of [...]` | `not in` | `{x} is not one of ["a"]` |
| `is valid email` | `regex/validate` | `{email} is valid email` |
| `is valid url` | `regex/validate` | `{url} is valid url` |
| `is logged in` | `auth.check` | `{user} is logged in` |
| `is not logged in` | `!auth.check` | `{user} is not logged in` |
| `exists` | `!= null` | `{user.avatar} exists` |
| `does not exist` | `== null` | `{user.avatar} does not exist` |
| `is true` | `=== true` | `{isActive} is true` |
| `is false` | `=== false` | `{isActive} is false` |

### Compound Conditions

```
If {user} is logged in and {user.role} is "admin":
If {age} is at least 18 or {hasParentalConsent} is true:
If {status} is "active" and {balance} is greater than 0:
```

Logical operators: `and`, `or`, `not`

Grouping (for complex logic):
```
If ({age} is at least 18 or {hasConsent} is true) and {country} is "US":
```

---

## 6. Components

### Defining a Component

```eng
---
type: component
name: UserCard
description: "Displays a user's profile summary"
props:
  - name: user
    type: object
    required: true
  - name: showEmail
    type: boolean
    default: false
  - name: size
    type: string
    default: "medium"
---

Create a card container:
  Group these as a horizontal row with spacing:
    Image {user.avatar} with alt "{user.name}'s photo" size 48px, rounded circle
    Group these vertically:
      Show {user.name} as bold text
      Show {user.role} as small muted text
      If {showEmail} is true:
        Link to "mailto:{user.email}" showing {user.email}
```

### Using a Component

```eng
Import userCard from "components/user-card.eng"

Place {userCard} with:
  user = {currentUser}
  showEmail = true
  size = "large"
```

### Component Slots (Children)

Components can accept nested content via a special `{children}` slot:

```eng
---
type: component
name: Panel
props:
  - name: title
    type: string
    required: true
---

Create a bordered panel:
  Show {title} as a panel heading
  Create a panel body:
    Slot {children} here
```

Usage:

```eng
Import panel from "components/panel.eng"

Place {panel} with title = "Recent Activity":
  Show "You have 3 new notifications" as text
  List {notifications} as compact items
```

---

## 7. Layouts & Slots

### Defining a Layout

```eng
---
type: layout
name: MainLayout
description: "Primary application layout with sidebar navigation"
---

Import navbar from "partials/navbar.eng"
Import sidebar from "partials/sidebar.eng"
Import footer from "partials/footer.eng"

Create the page wrapper as full viewport height:
  Place {navbar} at the top

  Create a horizontal layout below the navbar:
    Place {sidebar} on the left, width 250px
    Create the main content area, fills remaining width:
      Slot {pageTitle} here
      Slot {breadcrumbs} here
      Slot {body} here

  Place {footer} at the bottom, sticky
```

### Extending a Layout (Pages)

```eng
---
type: page
name: Dashboard
extends: "layouts/main.eng"
route: "/dashboard"
title: "Dashboard"
auth: required
---

Import statsCard from "components/stats-card.eng"
Import activityFeed from "components/activity-feed.eng"

Fill {pageTitle}:
  Show "Dashboard" as page heading

Fill {breadcrumbs}:
  Show breadcrumbs: Home > Dashboard

Fill {body}:
  Create a grid with 3 columns:
    Place {statsCard} with title = "Users", value = {totalUsers}, icon = "users"
    Place {statsCard} with title = "Revenue", value = {totalRevenue}, icon = "dollar"
    Place {statsCard} with title = "Orders", value = {totalOrders}, icon = "shopping-cart"

  Create a section below with margin top large:
    Show "Recent Activity" as section heading
    Place {activityFeed} with items = {recentActivity}
```

### Named Slots vs Default Slot

- **Named slots**: `Slot {slotName} here` → `Fill {slotName}:`
- **Default slot / children**: `Slot {children} here` → content nested under component placement

---

## 8. Imports & Composition

### Import Syntax

```eng
Import componentName from "relative/path/to/file.eng"
Import anotherName from "components/shared/button.eng"
```

### Import Rules

- Paths are relative to the project's `src/` directory
- File extension `.eng` is required in imports
- Import names must be camelCase
- Circular imports are **forbidden** (compiler will error)
- Unused imports generate warnings

### Aliased Imports

```eng
Import bigButton from "components/button.eng" as primaryAction
```

### Bulk Imports (for large pages)

```eng
Import:
  header from "partials/header.eng"
  footer from "partials/footer.eng"
  sidebar from "partials/sidebar.eng"
  statsCard from "components/stats-card.eng"
  dataTable from "components/data-table.eng"
```

---

## 9. Control Flow

### Loops

```eng
-- Basic loop
Loop over {posts} as {post}:
  Show {post.title} as a heading
  Show {post.excerpt} as paragraph

-- Loop with index
Loop over {items} as {item}, index {i}:
  Show "{i + 1}. {item.name}" as list item

-- Nested loops
Loop over {categories} as {category}:
  Show {category.name} as section heading
  Loop over {category.products} as {product}:
    Show {product.name} as text with price {product.price}

-- Loop with empty state
Loop over {results} as {result}:
  Show {result.title} as text
When {results} is empty:
  Show "No results found" as muted centered text

-- Loop with limit
Loop over first 5 of {notifications} as {notif}:
  Show {notif.message} as text

-- Loop with filter
Loop over {users} where {user.role} is "admin" as {admin}:
  Show {admin.name} as text
```

### Conditionals

```eng
-- Simple if
If {user} is logged in:
  Show "Welcome back, {user.name}" as greeting

-- If / Else
If {items} is not empty:
  Loop over {items} as {item}:
    Show {item.name}
Else:
  Show "Your cart is empty" as centered muted text

-- If / Else If / Else
If {user.role} is "admin":
  Show the admin control panel
Else If {user.role} is "editor":
  Show the editor toolbar
Else If {user.role} is "viewer":
  Show read-only content
Else:
  Show "Please contact support for access"

-- Inline conditional (short form)
Show {user.badge} if {user.isPremium} is true
Hide {promoSection} when {user.hasSubscription} is true
```

### Switch

```eng
Switch {order.status}:
  Case "pending":
    Show a yellow badge with "Pending"
  Case "processing":
    Show a blue badge with "Processing"
  Case "shipped":
    Show a green badge with "Shipped"
  Case "delivered":
    Show a green filled badge with "Delivered"
  Case "cancelled":
    Show a red badge with "Cancelled"
  Default:
    Show a gray badge with "Unknown"
```

---

## 10. Data Binding & Props

### Passing Props

```eng
-- Single prop
Place {userCard} with user = {currentUser}

-- Multiple props (inline for few)
Place {badge} with text = "New", color = "green", size = "small"

-- Multiple props (block for many)
Place {productCard} with:
  product = {item}
  showPrice = true
  currency = "USD"
  onAddToCart = handle addToCart with {item}
  layout = "horizontal"
```

### Prop Types

| Type | Description | Example Default |
|------|-------------|----------------|
| `string` | Text value | `"hello"` |
| `number` | Numeric value | `42` |
| `boolean` | True/false | `true` |
| `array` | List of items | `[]` |
| `object` | Key-value structure | `{}` |
| `image` | Image URL/path | `""` |
| `date` | Date value | `today` |
| `any` | No type restriction | `null` |

### Computed Values

```eng
Compute {fullName} as "{first} {last}"
Compute {total} as {price} times {quantity}
Compute {discountedPrice} as {price} minus ({price} times {discountRate})
Compute {isExpired} as {expiryDate} is before today
Compute {itemCount} as count of {items}
Compute {filteredUsers} as {users} where {user.active} is true
```

### Math Operations in Compute

| Natural Language | Operator |
|-----------------|----------|
| `plus` / `added to` | `+` |
| `minus` / `subtracted by` | `-` |
| `times` / `multiplied by` | `*` |
| `divided by` | `/` |
| `remainder of` / `modulo` | `%` |
| `rounded to N decimals` | `round()` |
| `count of` | `.length` |
| `sum of` | `.reduce(sum)` |
| `average of` | `.reduce(avg)` |
| `minimum of` | `Math.min()` |
| `maximum of` | `Math.max()` |

---

## 11. Events & Interactions

### Click Events

```eng
Create a button "Add to Cart":
  On click:
    Update {cartItems} by adding {product}
    Show toast "Item added to cart" type success
    Emit "cart-updated" with {cartItems}
```

### Other Events

```eng
-- Hover
Create a card container:
  On hover:
    Animate with scale-up subtle
  On hover end:
    Animate with scale-down subtle

-- Focus
Input for {search} type text:
  On focus:
    Show {searchSuggestions}
  On blur:
    Hide {searchSuggestions} after 200ms

-- Keyboard
Create the search area:
  On key "Enter":
    Submit {searchForm}
  On key "Escape":
    Clear {searchQuery}
    Hide {searchSuggestions}

-- Scroll
Create the content area:
  On scroll to bottom:
    Fetch more {posts} from "/api/posts" page {nextPage}

-- Window/document level
On page load:
  Fetch {userData} from "/api/me"
  Set {isLoading} to false

On page leave:
  If {hasUnsavedChanges} is true:
    Show confirm dialog "You have unsaved changes. Leave anyway?"
```

### Debounce & Throttle

```eng
Input for {searchQuery} type text:
  On change debounce 300ms:
    Fetch {results} from "/api/search?q={searchQuery}"

Create the scroll container:
  On scroll throttle 100ms:
    Update {scrollPosition}
```

---

## 12. Forms & Inputs

### Complete Form Example

```eng
---
type: component
name: RegisterForm
description: "User registration form with validation"
---

Set {formData} to:
  name: ""
  email: ""
  password: ""
  confirmPassword: ""
  agreeToTerms: false

Set {errors} to empty object
Set {isSubmitting} to false

Create a form "Registration":
  Create a form group:
    Input for {formData.name} type text:
      label "Full Name"
      placeholder "John Doe"
      required
      min length 2
      Validate: show error "Name must be at least 2 characters"

  Create a form group:
    Input for {formData.email} type email:
      label "Email Address"
      placeholder "john@example.com"
      required
      Validate: must be valid email
      Validate: show error "Please enter a valid email"

  Create a form group:
    Input for {formData.password} type password:
      label "Password"
      required
      min length 8
      Validate: must contain uppercase, lowercase, number
      Show password strength indicator for {formData.password}

  Create a form group:
    Input for {formData.confirmPassword} type password:
      label "Confirm Password"
      required
      Validate: must match {formData.password}
      Validate: show error "Passwords do not match"

  Create a form group:
    Checkbox for {formData.agreeToTerms}:
      label "I agree to the Terms of Service and Privacy Policy"
      required

  If {errors} is not empty:
    Create an error summary box:
      Loop over {errors} as {error}:
        Show {error} as red text

  Create a button "Create Account" type submit:
    disabled when {isSubmitting} is true or {formData.agreeToTerms} is false
    Show spinner when {isSubmitting} is true
    On click:
      Prevent default
      Validate all fields
      If all fields are valid:
        Set {isSubmitting} to true
        Submit {formData} to "/api/register" method POST
        On success:
          Show toast "Account created!" type success
          Navigate to "/login"
        On failure:
          Set {errors} to response errors
          Set {isSubmitting} to false
```

### Input Types

```eng
Input for {value} type text          -- standard text
Input for {value} type email         -- email with validation
Input for {value} type password      -- masked input
Input for {value} type number        -- numeric input
Input for {value} type tel           -- phone number
Input for {value} type url           -- URL input
Input for {value} type search        -- search with clear button
Input for {value} type color         -- color picker
Input for {value} type range         -- slider (min, max, step)
Textarea for {value} rows 4          -- multi-line text
Select {value} from {options}        -- dropdown
Checkbox for {value}                 -- boolean toggle
Radio {value} options [...]          -- single select group
Upload {value} accept images         -- file upload
Upload {value} accept documents      -- document upload
Upload {value} accept any            -- any file
DatePicker for {value}               -- date selector
DatePicker for {value} range         -- date range selector
TimePicker for {value}               -- time selector
```

### Validation Directives

```eng
required
min length N
max length N
min value N
max value N
must be valid email
must be valid url
must be valid phone
must match {otherField}
must contain uppercase, lowercase, number
must match pattern "regex"
Validate: custom message "..."
```

---

## 13. Styling Directives

### Natural Language Styles

Styles are described in natural language. The compiler maps them to CSS/utility classes.

```eng
Style this with:
  padding large
  margin top medium
  background white
  border thin gray rounded
  shadow medium
  text center
  font bold
  width full
  max width 800px
  gap medium
```

### Size Scale

| Token | Approximate Value |
|-------|-------------------|
| `tiny` | 4px / 0.25rem |
| `small` | 8px / 0.5rem |
| `medium` | 16px / 1rem |
| `large` | 24px / 1.5rem |
| `extra large` / `xlarge` | 32px / 2rem |
| `huge` | 48px / 3rem |
| `none` | 0 |
| `auto` | auto |
| Exact values | `24px`, `2rem`, `50%` |

### Color Tokens

```eng
-- Semantic colors
background primary
background secondary
background danger
background warning
background success
background info
background muted
background white
background black
background light gray
background dark gray

-- Text colors
color primary
color secondary
color muted
color danger
color white
color black

-- Custom colors (hex, rgb, hsl)
background "#3B82F6"
color "rgb(59, 130, 246)"
```

### Layout Directives

```eng
-- Flexbox
Group these as a flex row:
Group these as a flex column:
Group these as a flex row with spacing:
Group these as a flex row, centered vertically:
Group these as a flex row, space between:
Group these as a flex row, wrap:

-- Grid
Create a grid with 3 columns:
Create a grid with 3 columns, gap medium:
Create a grid with columns: 1fr 2fr 1fr:
Create a responsive grid, min column width 300px:

-- Positioning
Place this fixed at the top:
Place this sticky at the top:
Place this absolute, top right:
Center this horizontally:
Center this vertically:
Center this both ways:

-- Sizing
Style with width full:
Style with width half:
Style with width 300px:
Style with max width 1200px:
Style with min height 100vh:
Style with height auto:
```

### Responsive Design

```eng
Create a grid with 3 columns:
  Responsive on tablet: 2 columns
  Responsive on mobile: 1 column

Show {sidebar}:
  Responsive on mobile: hide

Style the heading with font size 3rem:
  Responsive on mobile: font size 1.5rem
```

### Breakpoint Tokens

| Token | Approximate Width |
|-------|-------------------|
| `mobile` | < 640px |
| `tablet` | 640px – 1024px |
| `desktop` | 1024px – 1280px |
| `wide` | > 1280px |

---

## 14. State Management

### Local State

```eng
Set {count} to 0
Set {isOpen} to false
Set {selectedTab} to "overview"
Set {items} to []
Set {formData} to:
  name: ""
  email: ""
```

### State Updates

```eng
Update {count} by adding 1
Update {count} by subtracting 1
Update {count} to {count} plus 5
Set {isOpen} to true
Toggle {isOpen}
Set {selectedTab} to "settings"

-- Array operations
Update {items} by adding {newItem}
Update {items} by removing {item}
Update {items} by removing item at index {i}
Update {items} by replacing item at index {i} with {updatedItem}
Clear {items}

-- Object operations
Update {formData.name} to "John"
Update {user} by merging {updates}
```

### Shared/Global State

```eng
-- Declaring shared state (in a dedicated state file)
---
type: fragment
name: AppState
description: "Global application state"
---

Store {currentUser} as shared state, default null
Store {theme} as shared state, default "light"
Store {cartItems} as shared state, default []
Store {notifications} as shared state, default []
Store {locale} as shared state, default "en"
```

```eng
-- Using shared state in any component
Use shared {currentUser}
Use shared {cartItems}

Show "Items in cart: {cartItems.count}"
```

### Watchers

```eng
Watch {searchQuery}:
  When changed:
    Fetch {results} from "/api/search?q={searchQuery}"

Watch {cartItems}:
  When changed:
    Compute {cartTotal} as sum of {cartItems.price}
    Store {cartTotal} in local storage
```

---

## 15. Data Fetching

### Basic Fetch

```eng
Fetch {posts} from "/api/posts"
```

### Fetch with States

```eng
Fetch {posts} from "/api/posts":
  While loading:
    Show skeleton loader, 3 rows
  On success:
    Loop over {posts} as {post}:
      Place {postCard} with post = {post}
  On failure:
    Show error message "Failed to load posts"
    Create a button "Retry":
      On click: retry fetching {posts}
  When {posts} is empty:
    Show "No posts yet" as centered muted text
```

### Fetch with Parameters

```eng
Fetch {userProfile} from "/api/users/{userId}"
Fetch {searchResults} from "/api/search?q={query}&page={page}&limit=20"
Fetch {filteredProducts} from "/api/products" with:
  method GET
  params:
    category = {selectedCategory}
    sort = {sortOrder}
    minPrice = {priceRange.min}
    maxPrice = {priceRange.max}
```

### Mutations (POST, PUT, DELETE)

```eng
Submit {formData} to "/api/posts" method POST:
  On success:
    Show toast "Post created!" type success
    Navigate to "/posts/{response.id}"
  On failure:
    Set {errors} to response errors

Submit {updatedData} to "/api/posts/{postId}" method PUT:
  On success:
    Show toast "Post updated!" type success

Delete from "/api/posts/{postId}":
  Confirm first: "Are you sure you want to delete this post?"
  On success:
    Update {posts} by removing post with id {postId}
    Show toast "Post deleted" type info
```

### Pagination

```eng
Fetch {posts} from "/api/posts" with pagination:
  page size 10
  Show pagination controls at the bottom:
    previous and next buttons
    page numbers
    Show "Page {currentPage} of {totalPages}"
```

### Infinite Scroll

```eng
Fetch {posts} from "/api/posts" with infinite scroll:
  initial page 1
  page size 20
  On scroll to bottom:
    Load next page
  While loading more:
    Show spinner at bottom
  When no more:
    Show "You've reached the end" as muted text
```

---

## 16. Routing & Navigation

### Route Definitions (in frontmatter)

```eng
---
type: page
name: UserProfile
route: "/users/:userId"
title: "User Profile"
auth: required
---
```

### Navigation

```eng
-- Basic navigation
Navigate to "/dashboard"
Navigate to "/users/{userId}"
Navigate to "/search?q={query}"

-- Back navigation
Navigate back

-- External links
Link to "https://example.com" showing "Visit Site" opens in new tab

-- Navigation with confirmation
Navigate to "/home":
  Confirm first if {hasUnsavedChanges}: "Discard unsaved changes?"
```

### Route Parameters

```eng
-- Accessing route params
Show {route.params.userId}
Fetch {user} from "/api/users/{route.params.userId}"
```

### Route Guards

```eng
---
type: page
name: AdminPanel
route: "/admin"
auth: required
role: admin
---

-- If user is not authenticated → redirect to /login
-- If user is not admin → redirect to /unauthorized
```

### Active Link Styling

```eng
Create navigation links:
  Link to "/dashboard" showing "Dashboard":
    Style as active when route is "/dashboard"
  Link to "/settings" showing "Settings":
    Style as active when route starts with "/settings"
```

---

## 17. Modals, Overlays & Toasts

### Modal Definition

```eng
---
type: modal
name: ConfirmDeleteModal
props:
  - name: itemName
    type: string
    required: true
  - name: onConfirm
    type: any
    required: true
---

Create a modal dialog:
  Show "Delete {itemName}?" as heading
  Show "This action cannot be undone." as text

  Create button row at the bottom, aligned right:
    Create a button "Cancel" style secondary:
      On click: Close this modal
    Create a button "Delete" style danger:
      On click:
        Call {onConfirm}
        Close this modal
```

### Modal Usage

```eng
Import confirmModal from "modals/confirm-delete.eng"

Set {showDeleteModal} to false
Set {itemToDelete} to null

Create a button "Delete Item" style danger:
  On click:
    Set {itemToDelete} to {currentItem}
    Open {confirmModal} with:
      itemName = {itemToDelete.name}
      onConfirm = handle deleteItem with {itemToDelete}
```

### Toasts / Notifications

```eng
-- Show toast (auto-dismisses)
Show toast "Changes saved" type success
Show toast "Something went wrong" type error
Show toast "Processing..." type info duration 5000ms
Show toast "Low disk space" type warning persistent

-- Toast positions
Show toast "Message" type info position top-right
Show toast "Message" type info position bottom-center
```

### Drawers / Side Panels

```eng
Set {drawerOpen} to false

Create a button "Filters":
  On click: Toggle {drawerOpen}

Create a drawer from the right, width 400px, visible when {drawerOpen} is true:
  Show "Filters" as heading
  -- filter content here
  Create a button "Apply":
    On click:
      Apply filters
      Toggle {drawerOpen}
```

---

## 18. Animations & Transitions

### Enter/Exit Animations

```eng
Animate with fade-in on appear
Animate with slide-in from left on appear
Animate with slide-in from bottom on appear, duration 300ms
Animate with scale-up on appear
Animate with fade-out on disappear
```

### Transition on State Change

```eng
If {isVisible} is true:
  Create a panel with transition fade, duration 200ms:
    Show {content}
```

### Animation Tokens

| Token | Description |
|-------|-------------|
| `fade-in` / `fade-out` | Opacity 0 → 1 / 1 → 0 |
| `slide-in from left/right/top/bottom` | Slide from edge |
| `slide-out to left/right/top/bottom` | Slide to edge |
| `scale-up` / `scale-down` | Scale from 0.95 → 1 / 1 → 0.95 |
| `bounce` | Elastic bounce effect |
| `spin` | 360° rotation |
| `pulse` | Subtle scale pulse |
| `shake` | Horizontal shake (for errors) |

### Staggered Animations (in loops)

```eng
Loop over {items} as {item}, index {i}:
  Animate with fade-in on appear, delay {i} times 50ms:
    Place {itemCard} with item = {item}
```

### Scroll Animations

```eng
Create a section:
  Animate with slide-in from bottom when scrolled into view:
    Show "Our Features" as section heading
```

### Loading Skeletons

```eng
While {data} is loading:
  Show skeleton loader matching {productCard} shape, count 6
```

---

## 19. Comments & Documentation

### Inline Comments

```eng
-- This is a comment (double dash)
-- Comments are ignored by the parser

Show {title} as heading  -- inline comment after a statement
```

### Documentation Comments

```eng
--- doc
This component renders the main navigation bar.
It includes the logo, navigation links, and user menu.
Collapses to a hamburger menu on mobile.
---
```

### TODO Markers

```eng
TODO: Add pagination here
TODO: Replace with real API endpoint
TODO: Add error boundary
```

### Debug Output (development only)

```eng
Debug {currentState}
Debug {user.permissions}
Debug "Reached this point"
```

---

## 20. Project Structure & Configuration

### Standard Project Structure

```
my-app/
├── eng.config.yaml          -- project configuration
├── src/
│   ├── layouts/
│   │   ├── main.eng
│   │   ├── auth.eng
│   │   └── admin.eng
│   ├── pages/
│   │   ├── home.eng
│   │   ├── dashboard.eng
│   │   ├── login.eng
│   │   └── users/
│   │       ├── index.eng
│   │       ├── show.eng
│   │       └── edit.eng
│   ├── components/
│   │   ├── shared/
│   │   │   ├── button.eng
│   │   │   ├── input.eng
│   │   │   ├── modal.eng
│   │   │   └── toast.eng
│   │   ├── user-card.eng
│   │   ├── post-card.eng
│   │   └── data-table.eng
│   ├── modals/
│   │   ├── confirm-delete.eng
│   │   └── create-post.eng
│   ├── partials/
│   │   ├── header.eng
│   │   ├── footer.eng
│   │   └── sidebar.eng
│   ├── state/
│   │   └── app-state.eng
│   └── assets/
│       ├── images/
│       └── fonts/
├── public/
│   └── index.html
└── dist/                    -- compiled output
```

### Configuration File (`eng.config.yaml`)

```yaml
# eng.config.yaml
project:
  name: "My Application"
  version: "1.0.0"
  description: "A web application built with .eng"

compiler:
  target: "laravel-blade"        # compilation target (see section 21)
  # target: "react"
  # target: "vue"
  # target: "svelte"
  # target: "html"
  # target: "nextjs"
  # target: "nuxt"
  # target: "angular"

  llm:
    provider: "anthropic"        # anthropic | openai | local
    model: "claude-sonnet-4-20250514"
    api_key_env: "ANTHROPIC_API_KEY"  # env var name

  output:
    directory: "./dist"
    clean_before_build: true

  css:
    framework: "tailwind"        # tailwind | bootstrap | bulma | vanilla | none
    version: "3"

  typescript: false              # generate TS instead of JS (for react/vue/svelte)

theming:
  primary: "#3B82F6"
  secondary: "#6366F1"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  info: "#06B6D4"
  font_heading: "Inter"
  font_body: "Inter"
  border_radius: "8px"
  spacing_unit: "4px"

routes:
  base_path: "/"
  not_found: "pages/404.eng"
  error: "pages/500.eng"

api:
  base_url: "/api"
  auth_header: "Authorization"
  auth_prefix: "Bearer"
  timeout: 30000

environment:
  development:
    api_base_url: "http://localhost:8000/api"
    debug: true
  production:
    api_base_url: "https://api.myapp.com"
    debug: false
```

---

## 21. Compilation Targets

The same `.eng` source compiles to different targets. The compiler (LLM-powered) receives the structured AST and produces framework-specific code.

### Supported Targets

| Target | Output | CSS Framework |
|--------|--------|---------------|
| `html` | Static HTML/CSS/JS | Vanilla / Tailwind |
| `laravel-blade` | Blade templates + routes + controllers | Tailwind / Bootstrap |
| `react` | React components (JSX) | Tailwind / CSS Modules |
| `nextjs` | Next.js pages + API routes | Tailwind |
| `vue` | Vue SFCs (.vue) | Tailwind / Bootstrap |
| `nuxt` | Nuxt pages + layouts | Tailwind |
| `svelte` | Svelte components | Tailwind |
| `angular` | Angular components + modules | Tailwind / Bootstrap |
| `astro` | Astro pages + components | Tailwind |
| `flutter` | Flutter widgets (Dart) | Material / Cupertino |

### Target-Specific Mappings

The compiler maps `.eng` concepts to target-specific implementations:

| `.eng` Concept | Laravel Blade | React | Vue |
|----------------|--------------|-------|-----|
| `Loop over` | `@foreach` | `.map()` | `v-for` |
| `If` | `@if` | `{condition && ...}` | `v-if` |
| `Slot` | `@yield` | `{children}` / named slots | `<slot>` |
| `Fill` | `@section` | props/children | `<template #name>` |
| `Set` | `$variable` | `useState()` | `ref()` |
| `Bind` | `wire:model` | `value + onChange` | `v-model` |
| `Fetch` | Controller method | `useEffect + fetch` | `onMounted + fetch` |
| `On click` | `onclick` / Livewire | `onClick` | `@click` |
| `Navigate` | `redirect()` / `<a>` | `useNavigate()` | `router.push()` |
| `Store` | Session / Cache | Context / Redux / Zustand | Pinia / Vuex |
| `Style` | Tailwind classes | Tailwind / CSS Modules | Tailwind / scoped CSS |
| `Animate` | CSS transitions | Framer Motion | Vue Transition |

---

## 22. Complete Examples

### Example 1: Simple Static Component

```eng
---
type: component
name: HeroSection
description: "Landing page hero with headline and CTA"
props:
  - name: headline
    type: string
    default: "Build faster with .eng"
  - name: subtitle
    type: string
    default: "English as a Programming Language"
---

Create a full-width section with large vertical padding, centered text:
  Show {headline} as a large heading, font size 4rem
  Show {subtitle} as paragraph text, muted color, max width 600px, centered
  Create a button row with gap medium, centered, margin top large:
    Create a button "Get Started" style primary, size large:
      On click: Navigate to "/docs"
    Create a button "View on GitHub" style secondary outline, size large:
      Link to "https://github.com/eng-lang" opens in new tab
```

### Example 2: Full CRUD Page

```eng
---
type: page
name: UserManagement
extends: "layouts/admin.eng"
route: "/admin/users"
title: "User Management"
auth: required
role: admin
---

Import userTable from "components/user-table.eng"
Import createUserModal from "modals/create-user.eng"
Import confirmDeleteModal from "modals/confirm-delete.eng"

Set {users} to []
Set {isLoading} to true
Set {searchQuery} to ""
Set {selectedRole} to "all"
Set {currentPage} to 1
Set {userToDelete} to null

Fetch {users} from "/api/admin/users" with:
  params:
    search = {searchQuery}
    role = {selectedRole}
    page = {currentPage}

Fill {pageTitle}:
  Show "User Management" as page heading

Fill {body}:
  -- Toolbar
  Create a toolbar row with space between, margin bottom medium:
    Group these as a row with gap medium:
      Input for {searchQuery} type search:
        placeholder "Search users..."
        On change debounce 300ms:
          Set {currentPage} to 1
          Refresh {users}

      Select {selectedRole} from ["all", "admin", "editor", "user"]:
        label "Role"
        On change:
          Set {currentPage} to 1
          Refresh {users}

    Create a button "Add User" style primary:
      Icon "plus" before text
      On click: Open {createUserModal}

  -- Content
  Fetch {users} from "/api/admin/users":
    While loading:
      Show skeleton loader matching table shape, 10 rows

    On success:
      Place {userTable} with:
        users = {users.data}
        onEdit = handle editUser
        onDelete = handle showDeleteConfirm
        sortable = true

      Show pagination controls for {users}:
        On page change:
          Set {currentPage} to selected page
          Refresh {users}

    On failure:
      Show error panel "Failed to load users":
        Create a button "Retry":
          On click: Refresh {users}

  -- Delete confirmation
  Place {confirmDeleteModal} with:
    visible when {userToDelete} is not null
    itemName = {userToDelete.name}
    onConfirm = handle deleteUser with {userToDelete}
    onCancel = Set {userToDelete} to null

-- Event Handlers
Handle editUser with {user}:
  Navigate to "/admin/users/{user.id}/edit"

Handle showDeleteConfirm with {user}:
  Set {userToDelete} to {user}

Handle deleteUser with {user}:
  Delete from "/api/admin/users/{user.id}":
    On success:
      Update {users.data} by removing {user}
      Set {userToDelete} to null
      Show toast "User deleted" type success
    On failure:
      Show toast "Failed to delete user" type error
```

### Example 3: Real-time Chat Component

```eng
---
type: component
name: ChatWindow
description: "Real-time messaging interface"
props:
  - name: conversationId
    type: string
    required: true
  - name: currentUser
    type: object
    required: true
---

Set {messages} to []
Set {newMessage} to ""
Set {isTyping} to false
Set {typingUser} to null

Fetch {messages} from "/api/conversations/{conversationId}/messages"

-- Subscribe to real-time updates
Listen to channel "conversation.{conversationId}":
  On "new-message" received as {incoming}:
    Update {messages} by adding {incoming}
    Scroll to bottom of message list
  On "user-typing" received as {data}:
    Set {typingUser} to {data.user}
    Set {isTyping} to true
  On "user-stopped-typing" received:
    Set {isTyping} to false

Create a flex column, height full:
  -- Message list
  Create a scrollable message area, flex grow:
    Loop over {messages} as {msg}:
      If {msg.sender.id} equals {currentUser.id}:
        Create a message bubble aligned right, background primary, text white:
          Show {msg.text} as text
          Show {msg.timestamp} as tiny muted text
      Else:
        Create a message bubble aligned left, background light gray:
          Show {msg.sender.name} as small bold text
          Show {msg.text} as text
          Show {msg.timestamp} as tiny muted text

    When {messages} is empty:
      Show "No messages yet. Start the conversation!" as centered muted text

  -- Typing indicator
  If {isTyping} is true:
    Show "{typingUser.name} is typing..." as small muted text with pulse animation

  -- Input area
  Create a fixed input bar at the bottom with padding medium:
    Group these as a row with gap small:
      Textarea for {newMessage} rows 1, auto-expand:
        placeholder "Type a message..."
        On key "Enter" without shift:
          Prevent default
          Call sendMessage
        On change debounce 500ms:
          Emit typing status to channel

      Create a button style primary, icon only:
        Icon "send"
        disabled when {newMessage} is empty
        On click: Call sendMessage

-- Functions
Handle sendMessage:
  If {newMessage} is not empty:
    Set {tempMessage} to {newMessage}
    Clear {newMessage}
    Submit {text: tempMessage} to "/api/conversations/{conversationId}/messages" method POST:
      On success:
        Scroll to bottom of message list
      On failure:
        Set {newMessage} to {tempMessage}
        Show toast "Failed to send message" type error
```

### Example 4: E-commerce Product Listing

```eng
---
type: page
name: ProductListing
extends: "layouts/shop.eng"
route: "/products"
title: "All Products"
---

Import productCard from "components/product-card.eng"
Import filterSidebar from "components/filter-sidebar.eng"
Import sortDropdown from "components/sort-dropdown.eng"

Set {products} to []
Set {filters} to:
  category: "all"
  priceMin: 0
  priceMax: 10000
  inStock: false
  rating: 0
Set {sortBy} to "newest"
Set {viewMode} to "grid"
Set {currentPage} to 1

Fill {body}:
  Create a horizontal layout with gap large:
    -- Sidebar Filters
    Create a sidebar, width 280px:
      Responsive on mobile: hide, show as drawer
      Place {filterSidebar} with:
        filters = {filters}
        onChange = handle updateFilters

    -- Main Content
    Create the main area, flex grow:
      -- Top bar
      Create a toolbar with space between, margin bottom medium:
        Show "{products.total} products found" as text

        Group these as a row with gap medium:
          Place {sortDropdown} with:
            value = {sortBy}
            onChange = handle updateSort

          Group these as a row:
            Create a button style {viewMode} is "grid" then "primary" else "ghost":
              Icon "grid"
              On click: Set {viewMode} to "grid"
            Create a button style {viewMode} is "list" then "primary" else "ghost":
              Icon "list"
              On click: Set {viewMode} to "list"

      -- Product Grid/List
      Fetch {products} from "/api/products" with:
        params:
          category = {filters.category}
          price_min = {filters.priceMin}
          price_max = {filters.priceMax}
          in_stock = {filters.inStock}
          min_rating = {filters.rating}
          sort = {sortBy}
          page = {currentPage}
          per_page = 24

        While loading:
          Show skeleton loader matching {productCard} shape:
            count 12
            layout {viewMode}

        On success:
          If {viewMode} is "grid":
            Create a responsive grid, min column width 280px, gap medium:
              Loop over {products.data} as {product}:
                Animate with fade-in on appear, stagger 50ms:
                  Place {productCard} with:
                    product = {product}
                    layout = "vertical"

          Else:
            Create a vertical list with gap small:
              Loop over {products.data} as {product}:
                Place {productCard} with:
                  product = {product}
                  layout = "horizontal"

          Show pagination controls for {products} at the bottom:
            On page change:
              Set {currentPage} to selected page
              Scroll to top of main area

        When {products.data} is empty:
          Create an empty state, centered:
            Icon "search" size 64px, muted
            Show "No products match your filters" as heading
            Show "Try adjusting your search or filter criteria" as muted text
            Create a button "Clear Filters":
              On click: Reset {filters} to defaults

-- Handlers
Handle updateFilters with {newFilters}:
  Set {filters} to {newFilters}
  Set {currentPage} to 1

Handle updateSort with {newSort}:
  Set {sortBy} to {newSort}
  Set {currentPage} to 1
```

### Example 5: Data Table with Sorting, Filtering & Bulk Actions

```eng
---
type: component
name: DataTable
description: "Configurable data table with sorting, filtering, selection, and bulk actions"
props:
  - name: data
    type: array
    required: true
  - name: columns
    type: array
    required: true
  - name: selectable
    type: boolean
    default: false
  - name: sortable
    type: boolean
    default: true
  - name: onRowClick
    type: any
    default: null
  - name: bulkActions
    type: array
    default: []
---

Set {sortColumn} to null
Set {sortDirection} to "asc"
Set {selectedRows} to []
Set {selectAll} to false

Compute {sortedData} as {data} sorted by {sortColumn} direction {sortDirection}
Compute {allSelected} as {selectedRows.count} equals {data.count}

Create a bordered rounded container with overflow hidden:
  -- Bulk actions bar (visible when items selected)
  If {selectedRows} is not empty:
    Create a bar with background info-light, padding small medium:
      Show "{selectedRows.count} items selected" as text
      Group these as a row with gap small:
        Loop over {bulkActions} as {action}:
          Create a button {action.label} style {action.style}:
            On click: Call {action.handler} with {selectedRows}
      Create a button "Clear Selection" style ghost:
        On click: Clear {selectedRows}

  -- Table
  Table with full width:
    -- Header row
    Table header row with background light gray:
      If {selectable} is true:
        Table header cell, width 40px:
          Checkbox for {selectAll}:
            On change:
              If {selectAll} is true:
                Set {selectedRows} to all items in {data}
              Else:
                Clear {selectedRows}

      Loop over {columns} as {col}:
        Table header cell:
          Group these as a row with gap tiny, cursor pointer:
            Show {col.label} as bold text
            If {sortable} is true:
              On click: Call toggleSort with {col.key}
              If {sortColumn} equals {col.key}:
                Icon {sortDirection} is "asc" then "arrow-up" else "arrow-down"

    -- Body rows
    Loop over {sortedData} as {row}, index {i}:
      Table row:
        Style with hover background light:
        On click: Call {onRowClick} with {row} if {onRowClick} exists

        If {selectable} is true:
          Table cell:
            Checkbox for row selection:
              checked when {row} is in {selectedRows}
              On change:
                Toggle {row} in {selectedRows}

        Loop over {columns} as {col}:
          Table cell:
            If {col.render} exists:
              Render {col.render} with {row}
            Else:
              Show {row[col.key]} as text

  -- Empty state
  When {data} is empty:
    Create centered padding large:
      Show "No data to display" as muted text

-- Handlers
Handle toggleSort with {columnKey}:
  If {sortColumn} equals {columnKey}:
    Toggle {sortDirection} between "asc" and "desc"
  Else:
    Set {sortColumn} to {columnKey}
    Set {sortDirection} to "asc"
```

---

## 23. Edge Cases & Rules

### Nesting Rules

- Maximum nesting depth: **6 levels**
- Loops can contain: Conditionals, other Loops, Components, any display keyword
- Conditionals can contain: Loops, other Conditionals, Components, any display keyword
- Components can contain: content for `{children}` slot only (not arbitrary nesting)

### Circular Dependencies

```eng
-- FORBIDDEN: A imports B, B imports A
-- File: a.eng
Import b from "b.eng"    -- ERROR if b.eng imports a.eng

-- The compiler will detect and error on circular imports
```

### Self-Referencing Components (Recursion)

```eng
-- ALLOWED with depth limit: Components CAN reference themselves
---
type: component
name: TreeNode
props:
  - name: node
    type: object
    required: true
  - name: depth
    type: number
    default: 0
---

Import treeNode from "tree-node.eng"  -- self-import is allowed

Show {node.label} as text
If {node.children} is not empty and {depth} is less than 10:
  Loop over {node.children} as {child}:
    Place {treeNode} with node = {child}, depth = {depth} plus 1
```

### Empty/Null Handling

```eng
-- Always handle potential null values
Show {user.name} if {user} exists
Show {user.avatar} or show default avatar

-- Default values in display
Show {user.bio} or "No bio provided"
Show {post.image} or placeholder image
```

### Whitespace & Indentation

- **2 spaces** per indent level (REQUIRED — tabs are invalid)
- Blank lines between logical sections are encouraged but not required
- Trailing whitespace is stripped
- A line with only whitespace is treated as blank

### Reserved Variable Names

```
{children}      -- component slot content
{route}         -- current route information
{route.params}  -- route parameters
{route.query}   -- query string parameters
{response}      -- API response data
{errors}        -- form/API validation errors
{this}          -- current component reference
```

---

## 24. Reserved Keywords

The following words are **reserved** and cannot be used as variable names, component names, or prop names:

```
Import, Place, Slot, Fill, Create, Show, Group, Hide,
Loop, If, Else, Switch, Case, Default,
Set, Bind, Fetch, Compute, Store, Update, Watch, Use,
On, Navigate, Submit, Emit, Toggle, Open, Close, Prevent,
List, Table, Image, Link, Icon, Markdown,
Input, Textarea, Select, Checkbox, Radio, Upload, DatePicker, TimePicker,
Style, Theme, Responsive, Animate,
Debug, Comment, TODO, Include,
Handle, Call, Refresh, Clear, Reset, Retry,
When, While, Or, And, Not,
Listen, Scroll, Confirm, Delete, Validate,
true, false, null, today, now
```

---

## 25. Error Handling

### API Error Handling

```eng
Fetch {data} from "/api/resource":
  On failure:
    If response status is 401:
      Navigate to "/login"
    Else If response status is 403:
      Show "You don't have permission" as error
    Else If response status is 404:
      Show "Resource not found" as error
    Else If response status is 422:
      Set {errors} to response validation errors
    Else:
      Show "Something went wrong. Please try again." as error
      Create a button "Retry":
        On click: Retry fetching {data}
```

### Error Boundaries

```eng
-- Wrap a section in an error boundary
Create error boundary:
  On error:
    Show "This section encountered an error" as error panel
    Create a button "Reload section":
      On click: Reset this error boundary
  Content:
    -- risky content here
    Place {complexWidget} with data = {data}
```

### Form Validation Errors

```eng
Input for {email} type email:
  required
  Validate: must be valid email
  Show error below: "Please enter a valid email address"
  Show error style: red text with icon, fade-in animation
```

---

## 26. Accessibility

### Built-in Accessibility

These are **automatic** — the compiler generates them without explicit `.eng` directives:

- All `Image` keywords require alt text (compiler warning if missing)
- All `Input` keywords should have associated labels
- All interactive elements are keyboard-navigable
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA landmarks for layouts (header, main, nav, footer)
- Focus traps in modals
- Screen reader announcements for toasts
- Sufficient color contrast (based on theme tokens)

### Explicit Accessibility Directives

```eng
Create a button "Menu" accessible as "Open navigation menu":
  -- adds aria-label

Show {content} accessible role "alert":
  -- adds role="alert"

Create a section accessible landmark "search":
  -- adds role="search"

Hide {decorativeImage} from screen readers:
  -- adds aria-hidden="true"

Show {liveCount} as live region, polite:
  -- adds aria-live="polite"
```

---

## 27. Future Considerations

These features are **explicitly not in v1.0** but are planned for future versions:

### v1.1 — Internationalization

```eng
-- Future: multi-language support
Show translated "welcome_message"
Show {price} formatted as currency in {locale}
Show {date} formatted as long date in {locale}
```

### v1.2 — Testing DSL

```eng
-- Future: test files alongside components
---
type: test
name: UserCardTest
tests: "components/user-card.eng"
---

Test "shows user name":
  Given props: user = {name: "John", role: "admin"}
  Expect to see "John"
  Expect to see "admin"

Test "hides email by default":
  Given props: user = {name: "John", email: "john@test.com"}
  Expect not to see "john@test.com"
```

### v1.3 — Server Actions / Backend Logic

```eng
-- Future: backend logic in .eng
---
type: action
name: CreateUser
---

Receive {name}, {email}, {password}
Validate {email} is unique in users table
Hash {password}
Insert into users table: {name}, {email}, {hashedPassword}
Send welcome email to {email}
Return {user}
```

### v1.4 — Database Schema

```eng
-- Future: database schema in .eng
---
type: schema
name: UserSchema
---

Table users:
  id as auto-incrementing primary key
  name as text, required, max 255
  email as text, required, unique
  password as text, required
  role as one of ["admin", "editor", "user"], default "user"
  avatar as image, optional
  created_at as timestamp, auto
  updated_at as timestamp, auto

  Has many posts
  Has many comments
  Has one profile
```

### v1.5 — AI-Powered Features

```eng
-- Future: AI directives in .eng
AI summarize {article.body} into 2 sentences, store as {summary}
AI classify {ticket.description} into ["bug", "feature", "question"], store as {category}
AI translate {content} to {targetLanguage}, store as {translated}
```

---

## Appendix A: Parser Output (AST Format)

Every `.eng` file parses into a JSON AST like this:

```json
{
  "type": "EngFile",
  "frontmatter": {
    "type": "component",
    "name": "UserCard",
    "props": [
      {"name": "user", "type": "object", "required": true},
      {"name": "showEmail", "type": "boolean", "default": false}
    ]
  },
  "imports": [
    {"name": "badge", "path": "components/badge.eng", "alias": null}
  ],
  "body": [
    {
      "type": "Create",
      "description": "a card container",
      "styles": [],
      "children": [
        {
          "type": "Show",
          "variable": "user.name",
          "modifier": "as bold text"
        },
        {
          "type": "If",
          "condition": {
            "left": "showEmail",
            "operator": "==",
            "right": true
          },
          "children": [
            {
              "type": "Show",
              "variable": "user.email",
              "modifier": "as text"
            }
          ],
          "else": null
        }
      ]
    }
  ]
}
```

---

## Appendix B: CLI Commands Reference

```bash
# Compile entire project
eng build

# Compile single file
eng build src/pages/home.eng

# Compile with target override
eng build --target=react

# Watch mode (recompile on changes)
eng watch

# Validate .eng files without compiling
eng lint

# Parse and output AST (for debugging)
eng parse src/pages/home.eng --format=json

# Initialize new project
eng init my-app

# Add a new page/component
eng add page UserProfile
eng add component ProductCard
eng add layout AdminLayout
eng add modal ConfirmDialog

# Show project info
eng info
```

---

*End of `.eng` Language Specification v1.0*
