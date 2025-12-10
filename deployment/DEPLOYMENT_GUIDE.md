# Shopping List Deployment Guide (Docker-in-LXC)

This guide follows a **Blue/Green Deployment** strategy integrated with a **Git Feature Branch** workflow.

## Prerequisites

1.  **Proxmox VE Server**: Running and accessible.
2.  **Caddy Reverse Proxy**:
    *   This guide assumes you have a central Caddy server.
    *   If you need to install it, see the [official install guide](https://caddyserver.com/docs/install).
3.  **Domain Name**: A domain or subdomain pointing to your Caddy server.

## Overview: The Lifecycle

1.  **Develop**: Work on a feature branch (e.g., `feature/react-ui`).
2.  **Deploy to Green**: specific LXC running the *branch* code.
3.  **Test**: Verify functionality on the Green server.
4.  **Promote Code**: Merge branch to `main`. Update Green server to `main`.
5.  **Promote Data (Go Live)**: Migrate data from Blue (Old Prod) to Green. Swap Caddy.

---

## Step 1: Set Up "Green" (Test) Environment

1.  **Create LXC**: Create a new container (e.g., `shoppinglist-v2`).
    *   **Template**: Debian 12 (Bookworm) or Ubuntu 24.04.
    *   **Cores**: 1 is sufficient.
    *   **Memory**: 512MB - 1GB.
    *   **Swap**: 512MB.
    *   **Disk**: 4GB - 8GB.
    *   **Unprivileged**: Yes (Safe).
    *   **Nesting**: Enable if running Docker inside LXC (Options -> Features -> Nesting).
2.  **Install Docker**:
    ```bash
    apt update && apt install -y curl git
    curl -fsSL https://get.docker.com | sh
    ```
3.  **Clone & Checkout Branch**:
    ```bash
    git clone https://github.com/straybiker/ShoppingList.git /root/ShoppingList
    cd /root/ShoppingList
    git checkout <YOUR_BRANCH_NAME>
    ```

## Step 2: Deploy & Test Branch

1.  Start the app on the **Green LXC**:
    ```bash
    docker-compose up -d --build
    ```
2.  **Verify**: Open `http://<GREEN_LXC_IP>:3000`.
    *   Test the new features.
    *   *Note: This environment currently has empty/test data.*

---

## Step 3: Promote Code (Merge to Main)

Once testing is successful, promote the code to `main` and prepare the Green server for production.

1.  **Local Machine (Git)**:
    ```bash
    git checkout main
    git merge <YOUR_BRANCH_NAME>
    git push origin main
    ```

2.  **Green LXC**:
    Switch the Green server to the official `main` code to match what "Production" should be.
    ```bash
    cd /root/ShoppingList
    git checkout main
    git pull origin main
    docker-compose up -d --build
    ```
    *The Green server is now running "Main" code.*

---

## Step 4: Migrate Data (Blue -> Green)

Now that Green is running the correct code (`main`), bring over the real user data from Blue.

### A. Export Data (On Blue/Old LXC)
1.  **Stop Blue**:
    ```bash
    docker-compose down
    ```
2.  **Backup Volume**:
    ```bash
    docker run --rm \
      -v shopping_list_data:/data \
      -v $(pwd):/backup \
      alpine tar cvf /backup/data_backup.tar /data
    ```

### B. Transfer Backup
*Run this on the **Blue/Old LXC**:*
```bash
scp data_backup.tar root@<GREEN_LXC_IP>:/root/ShoppingList/
```

### C. Import Data (On Green/New LXC)
1.  **Stop Green**:
    ```bash
    cd /root/ShoppingList
    docker-compose down
    ```
    *(Note: This deletes the test data you created in Step 2, which is expected.)*

2.  **Restore Volume**:
    ```bash
    docker run --rm \
      -v shopping_list_data:/data \
      -v $(pwd):/backup \
      alpine tar xvf /backup/data_backup.tar -C /
    ```
3.  **Start Green (Production Mode)**:
    ```bash
    docker-compose up -d
    ```
4.  **Final Verification**: Check `http://<GREEN_LXC_IP>:3000`. Your real lists should be there.

---

## Step 5: Swap Caddy (Go Live)

1.  Open your `Caddyfile` on the proxy server.
2.  Update the Production domain to point to the **Green LXC IP**.
    ```caddyfile
    shoppinglist.jamine.duckdns.org {
        reverse_proxy <GREEN_LXC_IP>:3000
    }
    ```
3.  Reload Caddy.

**Success!** The Green LXC is now your Production server running `main`. You can archive or delete the old Blue LXC.
