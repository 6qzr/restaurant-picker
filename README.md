# 🍽️ Chef's Choice - Restaurant Picker

A "Timeless Game" style application to solve the eternal question: **"Where should we eat?"**

Instead of overwhelming you with a list of 50 places, Chef's Choice uses a smart algorithm to curate just three perfect options: a **Safe Bet**, a **Hidden Gem**, and a **Wildcard**. It turns decision paralysis into a fun, gamified experience.

## ✨ Key Features

*   **🎰 Gamified "Slot Machine" Reveal**: Hit Spin and watch the options shuffle before landing on your recommendations.
*   **🚗 Adventure Mode**:
    *   **Standard Mode**: Finds the best food *closest* to you.
    *   **Adventure Mode**: Prioritizes highly-rated places *further away* (near your search radius limit) for when you want a nice drive.
*   **🎯 Smart Curation**:
    *   **Best Rated**: High volume, high rating (The crowd favorite).
    *   **Hidden Gem**: Amazing rating (>4.5) but fewer reviews (<150). The spots locals love.
    *   **Wildcard**: A randomized pick to shake up your routine.
*   **🚫 Veto Power**: Don't like a suggestion? Hit the **Ban (X)** button to veto it for the session and instantly swap it out.
*   **📍 Search Radius**: Fully adjustable search radius (1km - 50km).
*   **💰 Usage Tracker**: Built-in "Fuel Gauge" to track Google Maps API usage and estimated cost during development.

## 🛠️ Tech Stack

*   **Frontend**: React (Vite)
*   **Styling**: Tailwind CSS + `clsx` / `tailwind-merge`
*   **Maps**: Google Maps JavaScript API via `@vis.gl/react-google-maps`
*   **Animations**: Framer Motion
*   **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
*   Node.js (v16+)
*   A valid **Google Maps API Key** with "Places API" and "Maps JavaScript API" enabled.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/6qzr/restaurant-picker.git
    cd restaurant-picker
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

### Setting up the API Key
On first launch, the app will ask for your Google Maps API Key. It stores this key safely in your browser's `localStorage` for the demo.
*   *Note: For production deployment, you should configure this via `.env` variables.*

## 🎮 How to Play

1.  **Set your Radius**: How far are you willing to travel?
2.  **Pick a Mood**: Toggle **Adventure Mode** (Car Icon) if you want a road trip, or stay in **Standard Mode** (Armchair) for a quick bite.
3.  **Select Filters**: Craving Pizza? Asian? Arabian? Toggle the chips at the top.
4.  **SPIN!**: Watch the slot machine find your spots.
5.  **Refine**:
    *   Use **Swap** (Refresh icon) to rotate a specific card.
    *   Use **Veto** (Ban icon) to remove a place entirely.
6.  **Go**: Click the "Go" button to open navigation in Google Maps.

## 📂 Project Structure

```
src/
├── components/      # UI Components (Cards, Sliders, Modals)
├── services/        # Google Maps API & Usage Tracking logic
├── utils/           # Helper functions (Scoring logic, Geometry)
└── App.jsx          # Main application controller
```

## 📄 License

MIT. Go find some good food! 🍕
