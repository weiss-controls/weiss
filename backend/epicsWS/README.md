# epicsWS - EPICS Web Socket

This folder provides the source code for the EPICS Web Socket, used as bridge between PVA/CA and the
web application.

- The PVA library used is [p4p](https://github.com/epics-base/p4p/), see [PVAClient](./PVAClient).
- The CA library used is [PyEpics](https://pyepics.github.io/pyepics/), see
  [CAClient](./CAClient.py).

The web socket application and connection manager can be seen in [epicsWS](./epicsWS.py). The
concept was based on [ORNL PV Web Socket (PVWS)](https://github.com/ornl-epics/pvws).

### How it works

Based on the default protocol (see [.env](../.env.example)) or the channel prefix of the PV names
(e.g `pva://` or `ca://`), the WS chooses the correct provider. The incoming messages from all
origins are parsed through a common interface defined on [pvParser](./pvParser.py). This results in
a standard structure in the format of the `PVData` class, regardless of the origin of the message.

This class was based on the EPICS Normative Types (with minor modifications for convenience), so a
known format is used, and the front-end client only needs to know one data structure for all
protocols. Numeric array updates are encoded as raw binary payloads; snapshots use base64 JSON
encoding temporarily. Enum-like records include a separate field for enumeration strings.
