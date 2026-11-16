
import os
import qrcode

url = os.getenv("PATIENT_INTAKE_URL")

if not url:
    raise ValueError(
        "Please set PATIENT_INTAKE_URL before generating the QR code."
    )

qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)

qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(
    fill_color="black",
    back_color="white",
)

img.save("patient_intake_qr.png")

print("QR code generated successfully.")
