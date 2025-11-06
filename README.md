*TunnelX* is a simple and secure VPN manager that lets you monitor connections, manage users, and track real-time network activity — all from one clean web dashboard.
You can view who’s online, check data usage, disconnect users, and switch to admin mode anytime. Whether you're managing a small team or your own network, TunnelX keeps
everything organized and under your control.

## 🔮 Features

- 🔐 Secure VPN Service: Connect safely through TunnelX’s encrypted VPN network
- 🧑‍💼 User Management: Register, log in, and manage your account easily
- ⚡ Admin and User Mode: Toggle between user and admin views effortlessly
- 🧑🏼‍💻 Admin Mode: Admins can view all users and disconnect them instantly
- 👥 Admin Management: Existing admins can add other admins
- 📊 Live Stats Dashboard: Track data sent, received, and connection duration
- 🔒 Secure Authentication: Safe login and session handling with JWT
- 🚪 Quick Disconnect: Instantly cut off any active session with one click
- 📈 Real-Time Updates: Everything stays in sync without needing refreshes
- 📨 Activity Logs: Keep track of connection and disconnection events


## 💻 Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![ExpressJS](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Socket io](https://img.shields.io/badge/Socket.io-ffffff?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Git](https://img.shields.io/badge/GIT-E44C30?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)
![HTML](https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![OpenVPN](https://img.shields.io/badge/OpenVPN-EA7E20?style=for-the-badge&logo=openvpn&logoColor=white)


## ⚙️ Installation

1. **Fork this repository:** Click the Fork button located in the top-right corner of this page.
2. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/TunnelX.git
   ```
3. **Install dependencies:**

   ```bash
   cd tunnelx-frontend
   npm install
   cd ..
   cd tunnelx-backend
   npm install
   cd ..
   ```
   Make sure you install the MongoDB service and the service is running.

   To check if MongoDB service is running, go to services(system) and check for MongoDB service.

   If you cannot find MongoDB service, you can install MongoDB from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).



4. **Install OpenVPN service:**

   Install the OpenVPN service from [https://openvpn.net/community/](https://openvpn.net/community/).

   After the installation,
   
   - Open the file in the following directory [`tunnelx-backend/vpn_configs/vpnbook-openvpn-fr231/vpnbook-fr231-udp25000.ovpn`](tunnelx-backend/vpn_configs/vpnbook-openvpn-fr231/vpnbook-fr231-udp25000.ovpn).
   - On line number 12, you’ll find something like:
     
     `
     auth-user-pass C:\\Users\\pramo\\Downloads\\tunnelx\\tunnelx-backend\\vpn_configs\\vpnbook-openvpn-fr231\\auth.txt
     `
   - You need to **replace** it with your own local path to the `auth.txt` file:
     
     `
     auth-user-pass <your_local_path_to_auth.txt>
     `

     For windows,
     ```bash
     auth-user-pass C:\\path\\to\\your\\vpn_configs\\vpnbook-openvpn-fr231\\auth.txt
     ```

     For Linux / macOS,
     ```bash
     auth-user-pass /path/to/your/vpn_configs/vpnbook-openvpn-fr231/auth.txt
     ```

   Make sure the path points to the correct `auth.txt` file on your system.
   The `.ovpn` file won’t work unless it can find this file.

5. **Updating VPN credentials:**

   The `auth.txt` file stores your VPN username and password used by the `.ovpn` configuration.

   Example format:
   ```text
   vpnbook
   <7-length-aplhanumeric-password>
   ```

   **Note:** The password for VPNBook changes **weekly**.  You must update the password inside your `auth.txt` file regularly, or you’ll get an **authentication failed** error when connecting.

   You can always find the latest password on the official VPNBook website:  [https://www.vpnbook.com/](https://www.vpnbook.com/) under the OpenVPN section.

   <img width="956" height="473" alt="image" src="https://github.com/user-attachments/assets/0e8510a4-f438-413e-a5ba-4faa6af07822" />


6. **Enabling multiple OpenVPN connections:**

   ***This section is optional &mdash; skip it if a single OpenVPN connection is sufficient for your setup.***

   By default, **OpenVPN** allows only one active VPN connection per network interface.  

   If you attempt to start multiple sessions simultaneously, you may encounter errors such as interface conflicts, routing issues, or failed connections.

   This can be resolved by configuring multiple **TAP/TUN adapters** (virtual network interfaces) — one per OpenVPN connection.


   ### 🪟 Windows

   On Windows, OpenVPN uses **TAP-Windows adapters** (virtual Ethernet interfaces). Only one connection can use a given adapter at a time, so additional adapters must be created.

   #### 🧩 Steps:

   1. Open **Command Prompt** as Administrator.
   2. Navigate to the TAP driver directory:
      ```bash
      cd "C:\Program Files\TAP-Windows\bin"
      ```
   3. Add a new TAP adapter:
      ```bash
      addtap.bat
      ```
   4. Repeat the command if you need more adapters.

   ### Linux / macOS

   On Linux, OpenVPN typically uses TUN interfaces (virtual point-to-point interfaces). So, you don’t need to manually create TUN adapters like you do on Windows.

   When you start OpenVPN with a new device name (e.g., `tun0`, `tun1`, `tun2`), the operating system automatically creates the corresponding TUN interface.

   
8. **Start the servers:**

   **Frontend:**

   To start the frontend, open a **Command Prompt** and paste the following commands:
   ```bash
   cd tunnelx-frontend
   npm run dev
   ```
   
   **Backend:**

   To start the backend, open a **Command Prompt (Run as Administrator)** and paste the following commands:
   ```bash
   cd tunnelx-backend
   node server.js
   ```
   
9. **Access the application:**

   You can visit the following link to access the application.
   
   ```bash
   http://localhost:5173/
   ```

10. **Access from a different PC:**
   
    To access this application from a different PC, get the IPv4 address of the system on which the installation is done by using the following command.
    ```bash
    ipconfig
    ```
    
    Now, search the whole repository for `http://localhost:<port>/` and replace every instance of it with `http://<IPv4 address>:<port>/`.
   
    Now you can visit ```http://<IPv4 address>:5173/```.


