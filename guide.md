# 🕋 Qued User Guide & Platform Overview

Welcome to the **Qued Framework**, your professional workspace for conquering Data Structures & Algorithms. This guide will walk you through the platform's layout and how to configure your AI Engine.

---

## 🚀 Getting Started

1.  **Launch**: Run `Qued_v.1.exe`.
2.  **Identity**: Create or sign in to your local profile. Everything you do—your themes, code drafts, and progress—is saved to your private **"Slate,"** isolated from other users.
3.  **The Command Center**: Use the left sidebar to navigate between your **Mastery Dashboard**, **Practice Arena**, and **Duel Rooms**.

---

## 📊 Sub-Domain Mastery

The heart of Qued is the Mastery Grid. It tracks your proficiency across 40+ specialized DSA categories.
*   **Categories**: Topics are grouped into logical domains like *Dynamic Programming*, *Graphs*, *Strings*, and *Trees*.
*   **Tracking**: Click on a sub-domain to view your status, notes, and solved problems. Qued uses high-fidelity color coding to show your progress.

---

## ⚔️ Multi-User Code Duels [COMING SOON]

The live multiplayer dueling feature is currently undergoing a major architecture upgrade and is **not available** in the current version. Stay tuned for future updates!

---

## 🤖 Setting Up Your AI Coach (The AI Engine)

Qued relies on an AI Engine to judge your code. You have two ways to set this up depending on your hardware.

### Option 1: Local Setup (Recommended if you have a powerful GPU)
If you have an NVIDIA or high-end AMD/Apple GPU, you can run the AI entirely on your own machine using **Ollama**.

1.  **Download Ollama**: Visit [ollama.com](https://ollama.com) and download the installer for Windows.
2.  **Install & Run**: Run the installer. You will see the Ollama icon in your system tray.
3.  **Download a Model**: Open your terminal (Command Prompt or PowerShell) and type:
    ```bash
    ollama run llama3
    ```
    *This will download and run the model. Qued will now be able to communicate with your local AI via its standard port (11434).*

### Option 2: Cloud API Setup (Recommended for Laptops or older hardware)
If you don't have a strong GPU, you can use "Cloud" AI keys. Qued supports several providers:

*   **Groq (Fastest)**: 
    - Go to [console.groq.com](https://console.groq.com/keys).
    - Sign in and click "Create API Key."
    - Copy the key and paste it into the **Settings** menu inside Qued.
*   **OpenRouter**:
    - Go to [openrouter.ai](https://openrouter.ai/keys).
    - Create a key to access a wide variety of models like GPT-4 or Claude 3.
*   **Ollama Cloud**:
    - If you are using a managed Ollama instance, find your API key in your account dashboard.

---

## 📁 Installation Directory

*   `Qued_v.1.exe`: The main application workstation.
*   `guide.md`: This document.
*   `uninstall.exe`: Utility to safely remove the app and its data.

---
© 2026 Qued Platform. High-Performance DSA Engineering.
