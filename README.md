# ▶️ OpenVid

**Search Videos Across the Open Web.**
OpenVid is a privacy-first video search aggregator that unifies results from multiple open platforms into a single, beautiful interface. No login, no tracking, no cookies.

![OpenVid Preview](public/images/favicon.png)

## 🚀 Features

*   **Unified Search**: Search across 5 distinct platforms simultaneously:
    *   **PeerTube** (Decentralized web)
    *   **Internet Archive** (Public domain movies)
    *   **NASA Library** (Space exploration)
    *   **Wikimedia Commons** (Educational/Documentary)
    *   **Dailymotion** (General content)
*   **Privacy First**: 🛡️ Zero tracking cookies. No account required. All data (favorites, playlists, theme) is stored locally in your browser (`localStorage`).
*   **Smart Library & Playlists**: Create custom playlists, mark favorites, and organize your content without ever signing up.
*   **Advanced Filtering**: Filter results by **Duration** (Short/Medium/Long), **Date** (Today/Week/Year), and **Platform**. Instant client-side response.
*   **Voice Search**: Integrated Web Speech API support for hands-free searching. 🎤
*   **Modern UI/UX**: Fully responsive Glassmorphism design with automatic Dark/Light theme switching.

## 🛠️ Tech Stack

*   **Frontend**: Native HTML5, CSS3 (Custom Variables, Flexbox/Grid), Vanilla JavaScript (ES6+). Zero frameworks (No React/Vue).
*   **Backend**: Node.js & Express (ES Modules).
*   **APIs**: Integration with 5 public REST APIs.
*   **Storage**: Browser LocalStorage for persistence.

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/tsotraki/OpenVid.git
    cd openvid
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run the Server**
    ```bash
    npm start
    ```
    The app will be available at `http://localhost:3000`.

## 🤝 Contributing

Contributions are welcome! OpenVid is designed to be simple and hackable. Feel free to add new API sources or improve the UI.

## 📄 License

MIT License - Free to use and modify.
