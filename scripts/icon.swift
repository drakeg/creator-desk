import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let directory = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
for size in [16, 32, 64, 128, 256, 512, 1024] {
    let scale = CGFloat(size) / 1024
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.scaleBy(x: scale, y: scale)
    context.setFillColor(CGColor(red: 0.14, green: 0.36, blue: 0.30, alpha: 1))
    context.addPath(CGPath(roundedRect: CGRect(x: 48, y: 48, width: 928, height: 928), cornerWidth: 210, cornerHeight: 210, transform: nil)); context.fillPath()
    context.setStrokeColor(CGColor(red: 0.92, green: 0.94, blue: 0.85, alpha: 1)); context.setLineWidth(34); context.setLineJoin(.round); context.setLineCap(.round)
    context.addPath(CGPath(roundedRect: CGRect(x: 260, y: 290, width: 504, height: 340), cornerWidth: 30, cornerHeight: 30, transform: nil)); context.strokePath()
    context.move(to: CGPoint(x: 260, y: 650)); context.addLine(to: CGPoint(x: 716, y: 790)); context.addLine(to: CGPoint(x: 750, y: 685)); context.addLine(to: CGPoint(x: 295, y: 548)); context.closePath(); context.strokePath()
    for x in [365, 535] { context.move(to: CGPoint(x: x, y: 682 + (x-365)*140/456)); context.addLine(to: CGPoint(x: x+65, y: 600 + (x-365)*140/456)); context.strokePath() }
    context.setFillColor(CGColor(red: 0.92, green: 0.94, blue: 0.85, alpha: 1)); context.move(to: CGPoint(x: 468, y: 380)); context.addLine(to: CGPoint(x: 468, y: 540)); context.addLine(to: CGPoint(x: 605, y: 460)); context.closePath(); context.fillPath()
    let image = context.makeImage()!
    for (base, suffix) in [(size, ""), (size/2, "@2x")] where [16,32,128,256,512].contains(base) {
        let url = URL(fileURLWithPath: "\(directory)/icon_\(base)x\(base)\(suffix).png")
        let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, image, nil); CGImageDestinationFinalize(destination)
    }
}
