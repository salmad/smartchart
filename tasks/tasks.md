# SmartChart: Task Breakdown

1. Project setup  
   - venv, `requirements.txt`  
   - Folder structure (`backend/`, `frontend/`, `docs/`, `tasks/`)  
2. Documentation  
   - This project overview  
   - `architecture.mermaid` diagram  
3. Gradio UI  
   - Basic page with sample Plotly chart + chat input  
4. Chart engine  
   - Render a “hello world” Plotly Express chart  
   - Apply a static JSON patch to prove concept  
5. NLP integration  
   - Craft prompt template  
   - Parse JSON or Python snippet response  
6. Patch application  
   - Merge GPT response into `fig.to_dict()`  
   - Re–render updated chart  
7. Styling & themes  
   - Define a custom Plotly template that matches a “deck-ready” look  
8. Export  
   - Add download buttons (PNG/SVG)  
9. Testing  
   - Unit tests for patch logic  
   - Manual UI tests  
10. Deployment  
    - Choose a host (e.g. Streamlit Sharing, Heroku)  

---

## Next Steps  
- Review this outline  
- Pin down file locations for docs  
- Start on item 1 (project init + docs)  