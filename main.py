from baby_sitter.web import create_app, print_terminal_qr_code, resolve_public_url


PUBLIC_URL = resolve_public_url()
print_terminal_qr_code(PUBLIC_URL)

app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)