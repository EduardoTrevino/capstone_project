# Udyam Path - Entrepreneurial Learning Game

Udyam Path is an educational web application designed as an interactive narrative game. It aims to teach foundational entrepreneurial skills to high-school students, particularly those in rural India, by simulating the experience of running a drone leasing business for agriculture.

The application is built with a modern tech stack, deployed on Vercel, and utilizes OpenAI to create dynamic, AI-driven learning scenarios.

## Table of Contents

1.  [Project Overview](#1-project-overview)
    *   [Core Concept](#core-concept)
    *   [Key Features](#key-features)
2.  [Tech Stack & Architecture](#2-tech-stack--architecture)
3.  [Getting Started](#3-getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Database Setup](#database-setup)
    *   [Application Setup](#application-setup)
4.  [Application Flow](#4-application-flow)
    *   [User Onboarding](#user-onboarding)
    *   [The Gameplay Loop](#the-gameplay-loop)
    *   [Goal & Scenario Lifecycle](#goal--scenario-lifecycle)
5.  [Project Structure](#5-project-structure)
6.  [Database Schema](#6-database-schema)
7.  [Key API Endpoints](#7-key-api-endpoints)
8.  [Deployment & CI/CD](#8-deployment--ci-cd)

---

## 1. Project Overview

### Core Concept

The game places the user in the role of an entrepreneur starting a drone leasing venture. Users navigate real-life business scenarios, make decisions, and see the immediate impact of those choices on various business and personal growth metrics. The core of the experience is an AI-powered engine that generates unique narratives and challenges, ensuring each playthrough is different.

### Key Features

*   **AI-Powered Narrative Scenarios:** Utilizes OpenAI's GPT-4o to generate dynamic dialogues, decision points, and story consequences.
*   **Interactive Gameplay:** A point-and-click interface where users make choices that directly influence the game's outcome.
*   **Goal-Oriented Learning:** Users can select specific business goals (e.g., "Increase Revenue," "Achieve Market Dominance"), and the scenarios adapt to help them learn the necessary skills.
*   **Comprehensive Dashboard:** A central hub to track key performance indicators (KPIs), including:
    *   **Business Metrics:** Monetary Growth, Customer Satisfaction, Quality & Reputation.
    *   **Personal Growth Metrics:** Ethical Decision-Making, Risk-Taking Ability, and more.
*   **Persistent User Progress:** All user data, including progress, scores, and decisions, is stored in a Supabase database.
*   **Detailed Analytics Log:** A comprehensive log (`/dashboard/log`) that allows users to review their decisions and the resulting impact on all metrics for each scenario.

## 2. Tech Stack & Architecture

This project is built on a modern, serverless architecture that is both scalable and maintainable.

*   **Frontend:** **Next.js (React)** using the App Router.
*   **Styling:** **Tailwind CSS** with **shadcn/ui** for the component library.
*   **Backend & API:** **Next.js API Routes**, running in a serverless environment on Vercel.
*   **AI Engine:** **OpenAI API (gpt-4o-2024-08-06)** is the core of the scenario generation.
*   **Database:** **Supabase** (PostgreSQL) for data storage, user authentication, and real-time capabilities.
*   **Deployment:** **Vercel**, providing seamless integration with Next.js.
*   **CI/CD:** **GitHub Actions** are configured for continuous integration and deployment. Pushing to the `main` branch automatically triggers a new deployment to Vercel.

## 3. Getting Started

Follow these steps to set up the project for local development.

### Prerequisites

*   **Node.js** (v18 or later)
*   **npm** or **pnpm**
*   **Git**

### Database Setup

The application's backend is powered by Supabase.

1.  **Create a Supabase Project:**
    *   Go to [supabase.com](https://supabase.com) and create a new project.
    *   Save your **Project URL** and `anon` **public key**. You will need these for the environment variables.
    *   Also, generate and save the `service_role` key, which is required for server-side operations with elevated privileges. Find it under `Project Settings > API > Project API keys`.

2.  **Set up the Database Schema:**
    *   Navigate to the **SQL Editor** in your Supabase dashboard.
    *   Open the SQL files located in the `sql_queries/` directory of this project.
    *   Execute the `CREATE TABLE` statements from the following files to create the necessary tables and relationships:
        *   `table_creation_all.sql` (or individually run scripts for `users`, `goals`, `kcs`, `metrics`, etc.)
        *   Execute the function definitions from scripts like `fix_rpc_endpoint.sql` and `increment_user_kc_score.sql` to set up the necessary database functions.

### Application Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```
    or if using pnpm:
    ```bash
    pnpm install
    ```

3.  **Set Up Environment Variables:**
    *   Create a new file named `.env.local` in the root of the project.
    *   Add the following variables to the file, replacing the placeholder values with your actual keys from Supabase and OpenAI:
        ```env
        # OpenAI API Key
        OPENAI_API_KEY="sk-..."

        # Supabase Public Keys
        NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
        NEXT_PUBLIC_SUPABASE_ANON_KEY="ey..."

        # Supabase Service Role Key (for server-side admin tasks)
        # While not explicitly in the code, the backend logic may require it.
        # If write operations fail, this is likely needed.
        SUPABASE_SERVICE_ROLE_KEY="ey..."
        ```
    > **Note:** The `lib/supabase.ts` file initializes the client-side Supabase client. The server-side routes use this instance, but for admin-level operations (like bypassing RLS for metric updates), a separate admin client initialized with the `SUPABASE_SERVICE_ROLE_KEY` is best practice.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

5.  **Access the Application:**
    Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 4. Application Flow

### User Onboarding

1.  **Login/Registration (`/`):** A new user lands on the homepage, enters a username, and clicks "Start". The system checks if the user exists in the `users` table. If not, a new user is created. The `user.id` and `username` are stored in `localStorage`.
2.  **Introduction (`/intro/[step]`):** If the user's `intro_done` flag is `false`, they are redirected to a multi-step introduction sequence led by the character Rani Singh. Upon completion, the `intro_done` flag is set to `true` in the database.
3.  **Dashboard (`/dashboard`):** After the intro, the user lands on the main dashboard. If they haven't completed the dashboard tour (`dashboard_tour_done` flag), an interactive tour begins. If they have no `focused_goal_id`, a dialog prompts them to select one.

### The Gameplay Loop

The core of the application resides in the interaction between the game page and the lessons API.

1.  **Initiate Scenario:** The user navigates to the Game Page (`/dashboard/game`). The frontend sends a request to `POST /api/lessons` with the `userId` and `chosenOptionId: null`.
2.  **API Processing (`/api/lessons`):** This is the game's brain.
    *   It fetches the user's current state (goal, dialogue history, scores) from Supabase.
    *   It constructs a detailed system prompt for OpenAI, including the user's goal, available "Knowledge Components" (KCs), character personas, and game rules.
    *   It calls the OpenAI API to generate a JSON object for the next game step, which includes narrative, dialogue, and a `decisionPoint` with 4 options. Each option has associated `kc_impacts` (e.g., `[{ kc_identifier: 'KC1', score: 0.5 }]`).
    *   The generated options are shuffled to ensure variety in presentation.
    *   The API returns the generated scenario step to the frontend.
3.  **User Decision:** The frontend (`/dashboard/game/page.tsx`) displays the narrative and the decision options. The user selects an option.
4.  **Submit Decision:** The frontend sends a new request to `POST /api/lessons`, this time including the `chosenOptionId` of the user's choice.
5.  **API Processes Choice:** The API receives the choice.
    *   It identifies the `kc_impacts` from the chosen option in the *previous* step's data (stored in the dialogue history).
    *   It calls a Supabase RPC (`increment_user_kc_score`) to update the user's KC scores.
    *   It calculates the effect of the KC score changes on the main game metrics (e.g., Revenue, Reputation) based on the links in the `kc_metric_effects` table.
    *   It updates the user's metric values in the `user_metric_scores` table.
    *   It logs a highly detailed record of the cause-and-effect of this decision into the `historical_learning_analytics` table.
    *   It then repeats step #2 to generate the *next* part of the scenario based on the choice made.

### Goal & Scenario Lifecycle

*   A full scenario consists of **3 decision points**. After the third decision, the API sets `scenarioComplete: true`.
*   The frontend then displays the `ScenarioSummaryScreen`, showing the metric changes for that scenario.
*   The user has **3 attempts** (3 full scenarios) to achieve their chosen goal.
*   The `win_conditions_structured` JSONB in the `goals` table defines what is required to win (e.g., `[{ "metric_name": "Revenue", "operator": ">=", "value": 50000 }]`).
*   If the win conditions are met, the `user_goals.status` is set to `completed`.
*   If all 3 attempts are used and the goal is not met, the status is set to `failed_needs_retry`.

## 5. Project Structure

The project follows the standard Next.js App Router structure.

```
├── app/
│   ├── api/                  # Backend API routes
│   │   ├── lessons/route.ts  # The core game engine API
│   │   └── scenario/route.ts # (Other API routes)
│   ├── dashboard/            # All pages behind authentication
│   │   ├── game/page.tsx     # The main gameplay screen
│   │   ├── goal/page.tsx     # Goal selection & progress view
│   │   ├── growth/page.tsx   # Personal growth metrics dashboard
│   │   ├── log/page.tsx      # Detailed log of all past decisions
│   │   └── page.tsx          # The main business metrics dashboard
│   ├── intro/                # Onboarding/introduction pages
│   └── page.tsx              # The root page (Login)
├── components/
│   ├── ui/                   # Reusable UI components from shadcn/ui
│   ├── widgets/              # Dashboard KPI widgets
│   ├── ChatMessage.tsx       # Component for displaying dialogue
│   ├── GoalDialog.tsx        # Dialog for selecting a new goal
│   ├── ScenarioSummaryScreen.tsx # Screen shown after a scenario is complete
│   └── onboarding-tour.tsx   # The interactive tour component
├── lib/
│   ├── supabase.ts           # Supabase client initialization
│   ├── types.ts              # TypeScript type definitions
│   └── utils.ts              # Utility functions
├── public/                   # All static assets (images, audio, icons)
├── sql_queries/              # SQL scripts for DB setup and maintenance
├── styles/
└── tailwind.config.ts        # Tailwind CSS configuration
```

## 6. Database Schema

The Supabase database is central to the application's state management. Here are the key tables:

| Table                           | Description                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `users`                         | Stores user profile information, authentication status, progress flags (`intro_done`), and avatar URL.    |
| `goals`                         | Defines the high-level learning goals available in the game, including their win conditions.            |
| `user_goals`                    | A linking table that tracks a user's progress (`progress`, `status`) on a specific `goal`. Stores the complete `dialogue_history` for a goal attempt. |
| `kcs`                           | "Knowledge Components." The granular skills the game teaches (e.g., "Risk Analysis," "Customer Empathy"). |
| `metrics`                       | The quantifiable KPIs in the game (e.g., "Revenue," "Reputation," "Risk-Taking").                      |
| `user_kc_scores`                | Stores the current score for each user on each KC.                                                      |
| `user_metric_scores`            | Stores the current value for each user on each metric.                                                  |
| `kc_metric_effects`             | Defines the relationships between KCs and metrics (i.e., which KC impacts which metric).                 |
| `goal_kcs`                      | Defines which KCs are relevant for a particular goal.                                                   |
| `user_metric_history`           | Records a timeseries of a user's metric values, primarily used for charting on the dashboard.           |
| `historical_learning_analytics` | A critical table that logs every detail of every decision a user makes for in-depth analysis.           |

## 7. Key API Endpoints

The primary API endpoint drives the entire game.

### `POST /api/lessons`

This is the main endpoint for the gameplay loop.

*   **Request Body:**
    ```json
    {
      "userId": "uuid-of-the-user",
      "chosenOptionId": 0 // or 1, 2, 3. Send `null` to start a new scenario.
    }
    ```

*   **Success Response Body:**
    ```json
    {
      "scenarioStep": {
        "narrativeSteps": [
          { "character": "Rani", "pfp": "/path/to/img.png", "text": "Dialogue..." }
        ],
        "mainCharacterImage": "/path/to/char.png",
        "decisionPoint": {
          "question": "What should you do next?",
          "options": [
            { "text": "Option A", "optionId": 0, "kc_impacts": [...] },
            { "text": "Option B", "optionId": 1, "kc_impacts": [...] }
          ]
        },
        "scenarioComplete": false
      },
      "metricChangesSummary": [
        { "metricName": "Revenue", "change": 5750, "unit": "₹", "finalValue": 55750 }
      ],
      "goalStatusAfterStep": "active", // or "completed", "failed_needs_retry"
      "currentGoalProgress": 33,
      "currentDecisionCountInScenario": 1
    }
    ```

## 8. Deployment & CI/CD

*   **Deployment:** The application is deployed on **Vercel**.
*   **CI/CD Pipeline:** A GitHub Action is configured in the `.github/workflows` directory. Any push or merge to the `main` branch will automatically trigger this action, which builds, tests (if configured), and deploys the latest version of the application to Vercel, ensuring a seamless update process.