import os
import uvicorn


def main():
    port = int(os.environ.get("PORT", "17892"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
