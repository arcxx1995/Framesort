# AI Photo Organizer using OpenClaw --- Complete MVP Guide (Electron Stack)

## 1. MVP Architecture

### Overview

The MVP consists of 4 main components:

    Desktop App (Electron + React UI)
        ↓
    OpenClaw Agent Orchestrator
        ↓
    Local Processing Layer (Python Tools)
        ↓
    File System (User Photos Folder)

### Component Breakdown

#### 1. Desktop App (Frontend)

Purpose: User interaction

Responsibilities: - Select folder - Start scan - Show detected
projects - Enable auto-organize

Recommended stack:

Primary (Recommended): - Electron - React - Node.js

Alternative (Faster + lighter): - Tauri + React

Why Electron: - Full file system access - Easy desktop packaging - Fast
MVP development - Large ecosystem

------------------------------------------------------------------------

#### 2. OpenClaw Agent Layer (Brain)

Purpose: Controls all automation agents

Agents:

-   Folder Scanner Agent
-   Image Analysis Agent
-   Metadata Agent
-   Project Classification Agent
-   Folder Organizer Agent

OpenClaw orchestrates agent execution.

------------------------------------------------------------------------

#### 3. Processing Layer (Python tools)

Purpose: Executes real operations

Tools:

-   File scanning
-   Image metadata extraction
-   Image analysis
-   File moving

Python runs locally.

------------------------------------------------------------------------

#### 4. File System Layer

Purpose: Where photos exist and get organized

Example:

Before:

    Photos/
      IMG001.jpg
      IMG002.jpg

After:

    Photos/
      Wedding_Project/
         IMG001.jpg
         IMG002.jpg

------------------------------------------------------------------------

## 2. OpenClaw Agent Setup

### Agent 1 --- Folder Scanner Agent

Purpose: Scan user folder and find images

Input: - Folder path

Output: - List of image paths

Tool: Python file scanner

------------------------------------------------------------------------

### Agent 2 --- Image Analysis Agent

Purpose: Understand image content

Detects:

-   Wedding
-   Product
-   Portrait
-   Event

Tools:

Recommended: Florence-2 (local)

Alternative: OpenAI Vision API

Output example:

    Image: IMG001.jpg
    Type: Wedding
    Confidence: 0.92

------------------------------------------------------------------------

### Agent 3 --- Metadata Agent

Purpose: Extract EXIF data

Extracts:

-   Date
-   Camera
-   Location

Tool: Python EXIF extractor

------------------------------------------------------------------------

### Agent 4 --- Project Classification Agent

Purpose: Group similar images

Logic:

Group by:

-   Date proximity
-   Visual similarity
-   Metadata similarity

Output:

    Project: Wedding_Feb10
    Images: 245

------------------------------------------------------------------------

### Agent 5 --- Organizer Agent

Purpose: Create folders and move images

Actions:

-   Create folder
-   Move images

Tool: Python shutil

------------------------------------------------------------------------

## OpenClaw Agent Workflow

    User selects folder
        ↓
    Electron UI sends request
        ↓
    OpenClaw Scanner Agent
        ↓
    Analysis Agent
        ↓
    Metadata Agent
        ↓
    Classification Agent
        ↓
    Organizer Agent
        ↓
    Projects created
        ↓
    Results returned to UI

------------------------------------------------------------------------

## 3. Exact Tech Stack

### Desktop App

Primary:

-   Electron
-   React
-   Node.js

Alternative:

-   Tauri
-   React

------------------------------------------------------------------------

### Orchestration

OpenClaw

Purpose: Agent coordination

------------------------------------------------------------------------

### Backend Processing

Python 3.11

Libraries:

-   os
-   shutil
-   pillow
-   watchdog
-   numpy
-   sqlite3

------------------------------------------------------------------------

### Image Understanding

Recommended:

Florence-2 local model

Alternatives:

-   OpenAI Vision API
-   CLIP

------------------------------------------------------------------------

### Database

SQLite

Stores:

-   Project names
-   Image mappings
-   Scan history

------------------------------------------------------------------------

### Communication Layer

Electron Node backend communicates with Python via:

Options:

-   Local REST API (FastAPI recommended) or
-   Direct subprocess calls

Recommended:

FastAPI

------------------------------------------------------------------------

### File Watcher

watchdog

Purpose: Detect new photos automatically

------------------------------------------------------------------------

## 4. Folder Structure

    photo-organizer/
    │
    ├── electron-app/
    │   ├── src/
    │   ├── main.js
    │   ├── preload.js
    │
    ├── backend/
    │   ├── api.py
    │   ├── agents/
    │   │   ├── scanner_agent.py
    │   │   ├── analysis_agent.py
    │   │   ├── metadata_agent.py
    │   │   ├── classifier_agent.py
    │   │   ├── organizer_agent.py
    │
    ├── database/
    │   ├── projects.db
    │
    ├── models/
    │   ├── florence2/

------------------------------------------------------------------------

## 5. MVP Feature List

Required:

-   Select folder
-   Scan folder
-   Detect projects
-   Create folders
-   Move images

Optional:

-   Auto-organize toggle
-   Project rename
-   Review suggestions

------------------------------------------------------------------------

## 6. Why Electron is best for MVP

Advantages:

-   Fastest development
-   Native file system access
-   Easy Windows/Mac support
-   Easy Python integration
-   Huge ecosystem

------------------------------------------------------------------------

## 7. Build Time Estimate

Basic MVP: 2--5 days

Production version: 2--4 weeks

------------------------------------------------------------------------

## 8. Final Architecture Summary

    Electron UI
       ↓
    Node backend
       ↓
    FastAPI backend
       ↓
    OpenClaw agents
       ↓
    Python tools
       ↓
    File system

------------------------------------------------------------------------

## 9. Summary

This system:

-   Runs locally
-   Uses OpenClaw agents
-   Automatically detects photo projects
-   Organizes folders intelligently
-   Works with zero manual effort

Stack:

Electron + React + Node.js + Python + OpenClaw

------------------------------------------------------------------------

## 10. Current Working Implementation (in this repo)

Implemented now:

- Electron desktop UI with folder picker, Scan, and Organize actions
- FastAPI backend (`backend.app.main`) with:
  - `GET /health`
  - `POST /scan`
  - `POST /organize`
- Local pipeline services for:
  - recursive image scanning
  - RAW decode validation using `rawpy` for `.ARW`, `.NEF`, `.CR2`, `.CR3`, `.DNG`
  - Florence-2 local vision classification (`backend/app/services/analysis.py`)
  - EXIF/mtime date extraction
  - project grouping by category + capture date
  - file moving into `Organized_Projects/<project_name>/`
- SQLite persistence of runs/projects/moves in `backend/data/projects.db`

How to run:

1. Install Python deps:

   `pip install -r requirements.txt`

2. Place Florence-2 model files locally (default path):

   `models/florence2`

   Or set:

   `FLORENCE2_MODEL_REFERENCE=<local_model_path>`

3. Install Electron deps:

   `cd electron-app && npm install`

4. Start the desktop app:

   `npm start`

The Electron app starts the FastAPI backend automatically.
