# Shopping List App

A premium, simple shopping list application built with vanilla HTML, CSS, and JavaScript.

![Shopping List App Screenshot](C:/Users/stray/.gemini/antigravity/brain/27436429-b51a-4c7a-b131-0768fcec8060/shopping_list_screenshot_1764105898811.png)

## Features

- **Add Items**: Quickly add items to your list
- **Edit Quantity**: Increase or decrease item quantities
- **Mark as Completed**: Check off items as you shop
- **Sort Items**: Sort your list alphabetically (A-Z or Z-A)
  - *Note: Sort buttons appear only when there is more than one item.*
- **Delete Items**: Remove individual items or delete all completed items at once
- **Local Storage**: Your list is saved automatically to your browser's local storage
- **Multi-User Support**: Share lists via URL parameters

## URL Parameters

You can customize the shopping list using URL parameters:

### List ID
Create separate lists by adding a `list` parameter:
```
index.html?list=groceries
index.html?list=hardware_store
```
Each list ID maintains its own separate items in local storage.

### User Name
Track who added items by including a `user` parameter:
```
index.html?user=John
index.html?list=family_shopping&user=Sarah
```
The user name will be displayed above each item they add.

### Example URLs
- `index.html` - Default list, Guest user
- `index.html?list=weekly` - "weekly" list, Guest user
- `index.html?user=Mom` - Default list, items tagged as added by "Mom"
- `index.html?list=groceries&user=Dad` - "groceries" list, items tagged as added by "Dad"

## How to Run

### Local Development

1. Clone the repository or download the files
2. Open `index.html` in your web browser
3. Start adding items to your shopping list!

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# Access the app at http://localhost:8081
```

#### Using Docker CLI

```bash
# Build the image
docker build -t shopping-list .

# Run the container
docker run -d -p 8081:81 --name shopping-list-app shopping-list

# Access the app at http://localhost:8081
```

#### Stop and Remove

```bash
# Using Docker Compose
docker-compose down

# Using Docker CLI
docker stop shopping-list-app
docker rm shopping-list-app
```

## Technologies

- HTML5
- CSS3 (Custom properties, Flexbox, Animations)
- JavaScript (ES6+)
- LocalStorage API
