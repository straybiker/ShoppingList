# Shopping List - LXC Deployment Guide

This guide explains how to deploy the Shopping List application to a Proxmox LXC container.

## Prerequisites

- A Proxmox VE server.
- An LXC container running Debian (11/12) or Ubuntu (20.04/22.04).

## Steps

1.  **Create the LXC Container**:
    - In Proxmox, create a new CT.
    - Choose a Debian or Ubuntu template.
    - Assign resources (e.g., 1 core, 512MB RAM is plenty).
    - Start the container.

2.  **Transfer Files**:
    - You need to get the project files into the container. You can use `scp` or `git`.
    - **Option A (SCP)**:
        ```bash
        # From your local machine
        scp -r /path/to/ShoppingList root@<LXC_IP>:/root/
        ```
    - **Option B (Git)**:
        - Install git in the container: `apt install git`
        - Clone the repository: `git clone <YOUR_REPO_URL>`

3.  **Run the Setup Script**:
    - SSH into the container or use the Proxmox Console.
    - Navigate to the `deployment` directory inside the project.
    - Make the script executable and run it:
        ```bash
        cd /root/ShoppingList/deployment
        chmod +x setup_lxc.sh
        ./setup_lxc.sh
        ```

4.  **Access the App**:
    - Open your browser and go to `http://<LXC_IP_ADDRESS>:3000/`.
    - You should see the Shopping List app.

## Notes

- The app runs as a Node.js service (`shopping-list`) on port 3000.
- The application files are located at `/opt/shopping-list`.
- Data is stored in `/opt/shopping-list/data`.
