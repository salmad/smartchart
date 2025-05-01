# Technical Documentation

**Goal**  
Enable users to create rich, interactive charts and then “chat” with them (e.g. “add legend”, “remove background”) to apply edits in real-time.

---

## Tech Stack  
- Language: Python  
- UI: Gradio (chat + chart pane)  
- Chart Engine: Plotly Express (with custom template)  
- NLP: OpenAI GPT-4 for intent → JSON-patch  
- State: `st.session_state` or in-memory Python object  

---

## Architecture  
1. **Frontend (Gradio)**  
   - Two columns:  
     - Left: Plotly figure  
     - Right: Chatbot widget  
2. **Backend**  
   - Endpoint receives user message + current fig JSON  
   - Sends prompt to GPT-4, gets back chart modifications  
   - Applies patch to Plotly figure, returns updated fig