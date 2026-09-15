import uvicorn

if __name__ == "__main__":
    print("[Personalize Chat] Starting dev server with scoped watchdir and fast shutdown timeout...")
    uvicorn.run(
        "app.main:combined_asgi_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        timeout_graceful_shutdown=1
    )
