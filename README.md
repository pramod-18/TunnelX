*TunnelX* is a simple and secure VPN manager that lets you monitor connections, manage users, and track real-time network activity — all from one clean web dashboard.
You can view who’s online, check data usage, disconnect users, and switch to admin mode anytime. Whether you're managing a small team or your own network, TunnelX keeps
everything organized and under your control.

## 🔮 Features

- 🔐 Secure VPN Service: Connect safely through TunnelX’s encrypted VPN network
- 👥 User Management: Register, log in, and manage your account easily
- 🧑‍💼 Admin Mode: Toggle between user and admin views effortlessly
- ⚡ Admin Mode: Admins can view all users and disconnect them instantly
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



5. **Install OpenVPN service:**

   Install the OpenVPN service from [https://openvpn.net/community/](https://openvpn.net/community/).

   After the installation,
   
   - 
   - Open the file in the following directory [`main\tunnelx-backend\vpn_configs\vpnbook-openvpn-fr231\vpnbook-fr231-udp25000.ovpn`](main\tunnelx-backend\vpn_configs\vpnbook-openvpn-fr231\vpnbook-fr231-udp25000.ovpn). 
   
7. **Start the servers:**
   
   Backend:
   ```bash
   node server.js
   ```
   Frontend:
   ```bash
   cd public
   npm run dev
   ```
8. **Access the application:**
   
   ```bash
   http://localhost:5173/
   ```

9. **Access from a different PC:**
   
   To access this from a different PC, get the IPv4 address of the system in which installation is done by using the following command
    ```bash
   ipconfig
   ```
   Go to ``` public/src/socket.tsx ``` and change ``` localhost:3000 ``` to ``` <IPv4 address>:3000 ```
   
   Now you can visit ```http://<IPv4 address>:5173/```


