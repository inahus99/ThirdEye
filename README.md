# 🛡️ Third Eye

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/SuhaniTyagi)
[![Version](https://img.shields.io/badge/version-1.0.0-informational)](https://github.com/SuhaniTyagi)

A modern, developer-focused monitoring platform that provides real-time insights into your web services. Monitor less, know more, act faster.

---

## Key Features

-   **Real-time Dashboard:** See the status of all your services update live via WebSockets, with no need to refresh.
-   **SSL & Domain Expiration:** Get automatic warnings for SSL certificates and domains that are nearing their expiration date.
-   **Performance Monitoring:** Track your website's response time with every check to spot performance trends and identify slowdowns.
-   **Centralized Log Management:** Aggregate, search, and analyze logs from your services in one place to find root causes faster.
-  **Dedicated Status Pages:** Create beautiful, dedicated pages for each of your sites, showing live status, performance, and incident history.
-   **Modern & Responsive UI:** A clean, intuitive interface built with React and Chakra UI that looks great on any device.

---



## Tech Stack

This project is built with a modern and scalable tech stack:

-   **Frontend:**
    -   [React](https://reactjs.org/)
    -   [Chakra UI](https://chakra-ui.com/) for components and styling
    -   [Framer Motion](https://www.framer.com/motion/) for animations
    -   [Socket.IO Client](https://socket.io/docs/v4/client-api/) for real-time communication
    -   [Axios](https://axios-http.com/) for API requests
-   **Backend:**
    -   [Node.js](https://nodejs.org/)
    -   [Express](https://expressjs.com/)
    -   [Socket.IO](https://socket.io/)
    ---

##  Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (version 16.x or later) and `npm` or `yarn` installed on your machine.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/SuhaniTyagi/Third-Eye](https://github.com/SuhaniTyagi/Third-Eye)
    ```

2.  **Navigate to the backend and install dependencies:**
    ```sh
    cd Third-Eye/backend
    npm install
    ```

3.  **Navigate to the frontend and install dependencies:**
    ```sh
    cd ../frontend
    npm install
    ```

### Configuration

The project uses environment variables for configuration.

1.  **Frontend:** In the `/frontend` directory, create a file named `.env.local` and add the following, pointing to your local backend server's address:
    ```
    REACT_APP_API_URL=http://localhost:8080
    ```

2.  **Backend:** In the `/backend` directory, create a file named `.env` and add any necessary server-side variables.
    ```
    # Example .env for backend
    PORT=8080
    # Add database connection strings, API keys, etc.
    ```

---

##  Running the Application

1.  **Start the backend server:**
    From the `/backend` directory, run:
    ```sh
    npm start
    ```
    The server should now be running on the port you specified in your backend `.env` file (e.g., `http://localhost:8080`).

2.  **Start the frontend development server:**
    From the `/frontend` directory, run:
    ```sh
    npm start
    ```
    The application should now be available at `http://localhost:3000`.

---

##  License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

##  Contact

Suhani Tyagi – [https://github.com/inahus99](https://github.com/SuhaniTyagi)

Project Link: [https://github.com/inahus99](https://github.com/SuhaniTyagi/Third-Eye)