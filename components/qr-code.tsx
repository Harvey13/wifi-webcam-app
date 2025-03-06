"use client"

import { useEffect, useRef } from "react"

interface QRCodeProps {
  value: string
  size?: number
  bgColor?: string
  fgColor?: string
}

export default function QRCode({ value, size = 200, bgColor = "#FFFFFF", fgColor = "#000000" }: QRCodeProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const generateQRCode = async () => {
      if (!qrContainerRef.current) return

      // Dynamically import QRCode library
      const QRCodeStyling = (await import("qr-code-styling")).default

      const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        dotsOptions: {
          color: fgColor,
          type: "rounded",
        },
        backgroundOptions: {
          color: bgColor,
        },
        cornersSquareOptions: {
          type: "extra-rounded",
        },
        cornersDotOptions: {
          type: "dot",
        },
      })

      // Clear previous QR code
      if (qrContainerRef.current.firstChild) {
        qrContainerRef.current.removeChild(qrContainerRef.current.firstChild)
      }

      qrCode.append(qrContainerRef.current)
    }

    generateQRCode()
  }, [value, size, bgColor, fgColor])

  return <div ref={qrContainerRef} />
}

