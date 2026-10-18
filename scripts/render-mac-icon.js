ObjC.import('Cocoa');

function run(argv) {
  const canvasSize = 1024;
  const artworkSize = 824;
  const inset = (canvasSize - artworkSize) / 2;
  const source = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  if (!source) throw new Error('Cannot read icon artwork');
  const bitmap = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, canvasSize, canvasSize, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  const context = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap);
  $.NSGraphicsContext.setCurrentContext(context);
  context.setImageInterpolation($.NSImageInterpolationHigh);
  $.NSColor.clearColor.set;
  $.NSRectFillUsingOperation($.NSMakeRect(0, 0, canvasSize, canvasSize), $.NSCompositeCopy);
  // A pre-rounded iOS export needs transparent margins in a classic macOS icns.
  source.drawInRectFromRectOperationFraction($.NSMakeRect(inset, inset, artworkSize, artworkSize), $.NSZeroRect, $.NSCompositeSourceOver, 1);
  $.NSGraphicsContext.restoreGraphicsState;
  const png = bitmap.representationUsingTypeProperties($.NSPNGFileType, $.NSDictionary.dictionary);
  if (!png.writeToFileAtomically(argv[1], true)) throw new Error('Cannot write macOS icon');
}
