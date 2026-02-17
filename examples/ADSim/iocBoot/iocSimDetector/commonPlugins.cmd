# This is an example file for creating plugins
# It uses the following environment variable macros
# Many of the parameters defined in this file are also in commonPlugins_settings.req so if autosave is being
# use the autosave value will replace the value passed to this file.

# $(PREFIX)      Prefix for all records
# $(PORT)        The port name for the detector.  In autosave.
# $(QSIZE)       The queue size for all plugins.  In autosave.
# $(XSIZE)       The maximum image width; used to set the maximum size for row profiles in the NDPluginStats plugin and 1-D FFT
#                   profiles in NDPluginFFT.
# $(YSIZE)       The maximum image height; used to set the maximum size for column profiles in the NDPluginStats plugin
# $(NCHANS)      The maximum number of time series points in the NDPluginStats, NDPluginROIStats, and NDPluginAttribute plugins
# $(CBUFFS)      The maximum number of frames buffered in the NDPluginCircularBuff plugin
# $(MAX_THREADS) The maximum number of threads for plugins which can run in multiple threads. Defaults to 5.

# Create a netCDF file saving plugin
NDFileNetCDFConfigure("FileNetCDF1", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileNetCDF.template","P=$(PREFIX),R=netCDF1:,PORT=FileNetCDF1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a TIFF file saving plugin
NDFileTIFFConfigure("FileTIFF1", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileTIFF.template",  "P=$(PREFIX),R=TIFF1:,PORT=FileTIFF1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a JPEG file saving plugin
NDFileJPEGConfigure("FileJPEG1", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileJPEG.template",  "P=$(PREFIX),R=JPEG1:,PORT=FileJPEG1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a NeXus file saving plugin
NDFileNexusConfigure("FileNexus1", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileNexus.template", "P=$(PREFIX),R=Nexus1:,PORT=FileNexus1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create an HDF5 file saving plugin
NDFileHDF5Configure("FileHDF1", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileHDF5.template",  "P=$(PREFIX),R=HDF1:,PORT=FileHDF1,ADDR=0,TIMEOUT=1,XMLSIZE=2048,NDARRAY_PORT=$(PORT)")

# Create a Magick file saving plugin
#NDFileMagickConfigure("FileMagick1", $(QSIZE), 0, "$(PORT)", 0)
#dbLoadRecords("NDFileMagick.template","P=$(PREFIX),R=Magick1:,PORT=FileMagick1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create 4 ROI plugins
NDROIConfigure("ROI1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDROI.template",       "P=$(PREFIX),R=ROI1:,  PORT=ROI1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
NDROIConfigure("ROI2", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDROI.template",       "P=$(PREFIX),R=ROI2:,  PORT=ROI2,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
NDROIConfigure("ROI3", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDROI.template",       "P=$(PREFIX),R=ROI3:,  PORT=ROI3,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
NDROIConfigure("ROI4", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDROI.template",       "P=$(PREFIX),R=ROI4:,  PORT=ROI4,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create 8 ROIStat plugins
NDROIStatConfigure("ROISTAT1", $(QSIZE), 0, "$(PORT)", 0, 8, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDROIStat.template",   "P=$(PREFIX),R=ROIStat1:  ,PORT=ROISTAT1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT),NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:1:,PORT=ROISTAT1,ADDR=0,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:2:,PORT=ROISTAT1,ADDR=1,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:3:,PORT=ROISTAT1,ADDR=2,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:4:,PORT=ROISTAT1,ADDR=3,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:5:,PORT=ROISTAT1,ADDR=4,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:6:,PORT=ROISTAT1,ADDR=5,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:7:,PORT=ROISTAT1,ADDR=6,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDROIStatN.template",  "P=$(PREFIX),R=ROIStat1:8:,PORT=ROISTAT1,ADDR=7,TIMEOUT=1,NCHANS=$(NCHANS)")

# Create a processing plugin
NDProcessConfigure("PROC1", $(QSIZE), 0, "$(PORT)", 0, 0, 0)
dbLoadRecords("NDProcess.template",   "P=$(PREFIX),R=Proc1:,  PORT=PROC1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
# Create a TIFF file plugin to read dark and flatfield images into the processing plugin
NDFileTIFFConfigure("PROC1TIFF", $(QSIZE), 0, "$(PORT)", 0)
dbLoadRecords("NDFileTIFF.template",  "P=$(PREFIX),R=Proc1:TIFF:,PORT=PROC1TIFF,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a scatter plugin
NDScatterConfigure("SCATTER1", $(QSIZE), 0, "$(PORT)", 0, 0, 0)
dbLoadRecords("NDScatter.template",   "P=$(PREFIX),R=Scatter1:,  PORT=SCATTER1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a gather plugin with 8 ports
NDGatherConfigure("GATHER1", $(QSIZE), 0, 8, 0, 0)
dbLoadRecords("NDGather.template",   "P=$(PREFIX),R=Gather1:, PORT=GATHER1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=1, PORT=GATHER1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=2, PORT=GATHER1,ADDR=1,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=3, PORT=GATHER1,ADDR=2,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=4, PORT=GATHER1,ADDR=3,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=5, PORT=GATHER1,ADDR=4,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=6, PORT=GATHER1,ADDR=5,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=7, PORT=GATHER1,ADDR=6,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDGatherN.template",   "P=$(PREFIX),R=Gather1:, N=8, PORT=GATHER1,ADDR=7,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create 5 statistics plugins
NDStatsConfigure("STATS1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDStats.template",     "P=$(PREFIX),R=Stats1:,  PORT=STATS1,ADDR=0,TIMEOUT=1,HIST_SIZE=256,XSIZE=$(XSIZE),YSIZE=$(YSIZE),NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
NDTimeSeriesConfigure("STATS1_TS", $(QSIZE), 0, "STATS1", 1, 23)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Stats1:TS:, PORT=STATS1_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=STATS1,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

NDStatsConfigure("STATS2", $(QSIZE), 0, "ROI1",    0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDStats.template",     "P=$(PREFIX),R=Stats2:,  PORT=STATS2,ADDR=0,TIMEOUT=1,HIST_SIZE=256,XSIZE=$(XSIZE),YSIZE=$(YSIZE),NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
NDTimeSeriesConfigure("STATS2_TS", $(QSIZE), 0, "STATS2", 1, 23)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Stats2:TS:, PORT=STATS2_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=STATS2,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

NDStatsConfigure("STATS3", $(QSIZE), 0, "ROI2",    0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDStats.template",     "P=$(PREFIX),R=Stats3:,  PORT=STATS3,ADDR=0,TIMEOUT=1,HIST_SIZE=256,XSIZE=$(XSIZE),YSIZE=$(YSIZE),NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
NDTimeSeriesConfigure("STATS3_TS", $(QSIZE), 0, "STATS3", 1, 23)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Stats3:TS:, PORT=STATS3_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=STATS3,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

NDStatsConfigure("STATS4", $(QSIZE), 0, "ROI3",    0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDStats.template",     "P=$(PREFIX),R=Stats4:,  PORT=STATS4,ADDR=0,TIMEOUT=1,HIST_SIZE=256,XSIZE=$(XSIZE),YSIZE=$(YSIZE),NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
NDTimeSeriesConfigure("STATS4_TS", $(QSIZE), 0, "STATS4", 1, 23)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Stats4:TS:, PORT=STATS4_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=STATS4,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

NDStatsConfigure("STATS5", $(QSIZE), 0, "ROI4",    0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDStats.template",     "P=$(PREFIX),R=Stats5:,  PORT=STATS5,ADDR=0,TIMEOUT=1,HIST_SIZE=256,XSIZE=$(XSIZE),YSIZE=$(YSIZE),NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
NDTimeSeriesConfigure("STATS5_TS", $(QSIZE), 0, "STATS5", 1, 23)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Stats5:TS:, PORT=STATS5_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=STATS5,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

# Create a transform plugin
NDTransformConfigure("TRANS1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDTransform.template", "P=$(PREFIX),R=Trans1:,  PORT=TRANS1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create an overlay plugin with 8 overlays
NDOverlayConfigure("OVER1", $(QSIZE), 0, "$(PORT)", 0, 8, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDOverlay.template", "P=$(PREFIX),R=Over1:, PORT=OVER1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:1:,NAME=ROI1,   SHAPE=1,O=Over1:,XPOS=$(PREFIX)ROI1:MinX_RBV,YPOS=$(PREFIX)ROI1:MinY_RBV,XSIZE=$(PREFIX)ROI1:SizeX_RBV,YSIZE=$(PREFIX)ROI1:SizeY_RBV,PORT=OVER1,ADDR=0,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:2:,NAME=ROI2,   SHAPE=1,O=Over1:,XPOS=$(PREFIX)ROI2:MinX_RBV,YPOS=$(PREFIX)ROI2:MinY_RBV,XSIZE=$(PREFIX)ROI2:SizeX_RBV,YSIZE=$(PREFIX)ROI2:SizeY_RBV,PORT=OVER1,ADDR=1,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:3:,NAME=ROI3,   SHAPE=1,O=Over1:,XPOS=$(PREFIX)ROI3:MinX_RBV,YPOS=$(PREFIX)ROI3:MinY_RBV,XSIZE=$(PREFIX)ROI3:SizeX_RBV,YSIZE=$(PREFIX)ROI3:SizeY_RBV,PORT=OVER1,ADDR=2,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:4:,NAME=ROI4,   SHAPE=1,O=Over1:,XPOS=$(PREFIX)ROI4:MinX_RBV,YPOS=$(PREFIX)ROI4:MinY_RBV,XSIZE=$(PREFIX)ROI4:SizeX_RBV,YSIZE=$(PREFIX)ROI4:SizeY_RBV,PORT=OVER1,ADDR=3,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:5:,NAME=Cursor1,SHAPE=1,O=Over1:,XPOS=junk,                  YPOS=junk,                  XSIZE=junk,                   YSIZE=junk,                   PORT=OVER1,ADDR=4,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:6:,NAME=Cursor2,SHAPE=1,O=Over1:,XPOS=junk,                  YPOS=junk,                  XSIZE=junk,                   YSIZE=junk,                   PORT=OVER1,ADDR=5,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:7:,NAME=Box1,   SHAPE=1,O=Over1:,XPOS=junk,                  YPOS=junk,                  XSIZE=junk,                   YSIZE=junk,                   PORT=OVER1,ADDR=6,TIMEOUT=1")
dbLoadRecords("NDOverlayN.template","P=$(PREFIX),R=Over1:8:,NAME=Box2,   SHAPE=1,O=Over1:,XPOS=junk,                  YPOS=junk,                  XSIZE=junk,                   YSIZE=junk,                   PORT=OVER1,ADDR=7,TIMEOUT=1")

# Create 2 color conversion plugins
NDColorConvertConfigure("CC1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDColorConvert.template", "P=$(PREFIX),R=CC1:,  PORT=CC1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
NDColorConvertConfigure("CC2", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
dbLoadRecords("NDColorConvert.template", "P=$(PREFIX),R=CC2:,  PORT=CC2,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create a circular buffer plugin
NDCircularBuffConfigure("CB1", $(QSIZE), 0, "$(PORT)", 0, $(CBUFFS), 0)
dbLoadRecords("NDCircularBuff.template", "P=$(PREFIX),R=CB1:,  PORT=CB1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")

# Create an NDAttribute plugin with 8 attributes
NDAttrConfigure("ATTR1", $(QSIZE), 0, "$(PORT)", 0, 8, 0, 0, 0)
dbLoadRecords("NDAttribute.template",  "P=$(PREFIX),R=Attr1:,    PORT=ATTR1,ADDR=0,TIMEOUT=1,NCHANS=$(NCHANS),NDARRAY_PORT=$(PORT)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:1:,  PORT=ATTR1,ADDR=0,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:2:,  PORT=ATTR1,ADDR=1,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:3:,  PORT=ATTR1,ADDR=2,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:4:,  PORT=ATTR1,ADDR=3,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:5:,  PORT=ATTR1,ADDR=4,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:6:,  PORT=ATTR1,ADDR=5,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:7:,  PORT=ATTR1,ADDR=6,TIMEOUT=1,NCHANS=$(NCHANS)")
dbLoadRecords("NDAttributeN.template", "P=$(PREFIX),R=Attr1:8:,  PORT=ATTR1,ADDR=7,TIMEOUT=1,NCHANS=$(NCHANS)")
NDTimeSeriesConfigure("ATTR1_TS", $(QSIZE), 0, "ATTR1", 1, 8)
dbLoadRecords("$(ADCORE)/db/NDTimeSeries.template",  "P=$(PREFIX),R=Attr1:TS:, PORT=ATTR1_TS,ADDR=0,TIMEOUT=1,NDARRAY_PORT=ATTR1,NDARRAY_ADDR=1,NCHANS=$(NCHANS),ENABLED=1")

# Create an FFT plugin
NDFFTConfigure("FFT1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, 5)
dbLoadRecords("NDFFT.template", "P=$(PREFIX), R=FFT1:, PORT=FFT1, ADDR=0, TIMEOUT=1, NDARRAY_PORT=$(PORT), NAME=FFT1, NCHANS=$(XSIZE)")

# Create 2 Codec plugins
NDCodecConfigure("CODEC1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, 5)
dbLoadRecords("NDCodec.template", "P=$(PREFIX), R=Codec1:, PORT=CODEC1, ADDR=0, TIMEOUT=1, NDARRAY_PORT=$(PORT)")
NDCodecConfigure("CODEC2", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, 5)
dbLoadRecords("NDCodec.template", "P=$(PREFIX), R=Codec2:, PORT=CODEC2, ADDR=0, TIMEOUT=1, NDARRAY_PORT=$(PORT)")

# Create a bad pixel plugin
NDBadPixelConfigure("BADPIX1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, 5)
dbLoadRecords("NDBadPixel.template", "P=$(PREFIX), R=BadPix1:, PORT=BADPIX1, ADDR=0, TIMEOUT=1, NDARRAY_PORT=$(PORT)")

dbLoadRecords("$(AUTOSAVE)/db/save_restoreStatus.db", "P=$(PREFIX)")
dbLoadRecords("$(AUTOSAVE)/db/configMenu.db", "P=$(PREFIX), CONFIG=ADAutoSave")

# Load NDPluginPva plugin
NDPvaConfigure("PVA1", $(QSIZE), 0, "$(PORT)", 0, $(PREFIX)Pva1:Image, 0, 0, 0)
dbLoadRecords("NDPva.template",  "P=$(PREFIX),R=Pva1:, PORT=PVA1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
#Must start PVA server if this is enabled
startPVAServer

# Optional: load ffmpegServer plugin
#ffmpegServerConfigure(8081)
#ffmpegStreamConfigure("FfmStream1", 2, 0, "$(PORT)", 0, -1, 0)
#dbLoadRecords("$(FFMPEGSERVER)/db/ffmpegStream.template", "P=$(PREFIX),R=ffmstream1:,PORT=FfmStream1,NDARRAY_PORT=$(PORT)")
#ffmpegFileConfigure("FfmFile1", 16, 0, "$(PORT)", 0, -1, 0)
#dbLoadRecords("$(FFMPEGSERVER)/db/ffmpegFile.template", "P=$(PREFIX),R=ffmfile1:,PORT=FfmFile1,NDARRAY_PORT=$(PORT)")
#set_requestfile_path("$(FFMPEGSERVER)/db")

# Optional: load NDPluginEdge plugin
#NDEdgeConfigure("EDGE1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0)
#dbLoadRecords("$(ADPLUGINEDGE)/db/NDEdge.template",  "P=$(PREFIX),R=Edge1:, PORT=EDGE1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
#set_requestfile_path("$(ADPLUGINEDGE)/db")

# Optional: load NDPluginCV plugin
#NDCVConfigure("CV1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
#dbLoadRecords("$(ADCOMPVISION)/db/NDCV.template",  "P=$(PREFIX),R=CV1:, PORT=CV1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
#set_requestfile_path("$(ADCOMPVISION)/db")

# Optional: load NDPluginBar plugin
#NDBarConfigure("BAR1", $(QSIZE), 0, "$(PORT)", 0, 0, 0, 0, 0, $(MAX_THREADS=5))
#dbLoadRecords("$(ADPLUGINBAR)/db/NDBar.template",  "P=$(PREFIX),R=Bar1:, PORT=BAR1,ADDR=0,TIMEOUT=1,NDARRAY_PORT=$(PORT)")
#set_requestfile_path("$(ADPLUGINBAR)/db")

# Optional: load scan records
#dbLoadRecords("$(SSCAN)/db/scan.db", "P=$(PREFIX),MAXPTS1=2000,MAXPTS2=200,MAXPTS3=20,MAXPTS4=10,MAXPTSH=10")
#set_requestfile_path("$(SSCAN)/db")

# Optional: load sseq record for acquisition sequence
#dbLoadRecords("$(CALC)/db/sseqRecord.db", "P=$(PREFIX), S=AcquireSequence")
#set_requestfile_path("$(CALC)/db")

# Optional: load devIocStats records (requires DEVIOCSTATS module)
#dbLoadRecords("$(DEVIOCSTATS)/db/iocAdminSoft.db", "IOC=$(PREFIX)")

# Optional: load alive record (requires ALIVE module)
#dbLoadRecords("$(ALIVE)/db/alive.db", "P=$(PREFIX),RHOST=192.168.1.254")

# Set the callback queue size to 5000, up from default of 2000 in base.
# This can be needed to avoid errors "callbackRequest: cbLow ring buffer full".
callbackSetQueueSize(5000)
