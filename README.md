# Shopping List App

A modern, real-time shopping list application built with Node.js, Express, and vanilla HTML/CSS/JS.

## Features

- **Real-time Synchronization**: Updates appear instantly across all connected devices using Server-Sent Events (SSE).
- **Backend Storage**: Lists are saved persistently on the server (JSON file storage), allowing access from any device.
- **Multi-User & Multi-List**: Create separate lists and track who added items via URL parameters.
- **Slash Commands**: Use `/clear-cache` to instantly delete all items in the current list.
- **Smart UI**:
  - Dark premium theme with glassmorphism effects.
  - Responsive design for mobile and desktop.
  - Accessible custom checkboxes.
  - Toast notifications for feedback.
- **List Management**:
  - Add, edit quantity, and delete items.
  - Mark items as completed.
  - "Delete Completed" button to clean up the list.
  - Sort items alphabetically (A-Z, Z-A).
- **Security & Performance**:
  - Rate limiting (100 requests/15 min per IP).
  - Input validation (128 char limit).
  - Write queue system to handle concurrent updates safely.

## URL Parameters

Customize your experience using URL parameters:

### List ID
Create separate lists by adding a `list` parameter:
```
http://localhost:3000/?list=groceries
http://localhost:3000/?list=hardware_store
```
*Default list: "default"*

### User Name
Track who added items by including a `user` parameter:
```
http://localhost:3000/?user=John
http://localhost:3000/?list=family&user=Sarah
```
*Default user: "Guest"*

## Installation & Running

### Local Development

1. **Prerequisites**: Ensure Node.js is installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
   The server will start on **port 3000** by default.
4. **Access the App**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker compose up -d --build

# Access the app at http://localhost:8081
```

#### Using Docker CLI

```bash
# Build the image
docker build -t shopping-list .

# Run the container (mapping host port 8081 to container port 3000)
docker run -d -p 8081:3000 --name shopping-list-app shopping-list
```

## Technologies

- **Frontend**: HTML5, CSS3 (Variables, Flexbox, Animations), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.
- **Real-time**: Server-Sent Events (SSE).
- **Data**: JSON file-based persistence.
- **Containerization**: Docker.
