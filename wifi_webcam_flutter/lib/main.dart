import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'WiFi Webcam Streamer',
        theme: ThemeData.dark(),
        home: const StreamerPage(),
      );
}

class StreamerPage extends StatefulWidget {
  const StreamerPage({super.key});
  @override
  _StreamerPageState createState() => _StreamerPageState();
}

class _StreamerPageState extends State<StreamerPage> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? qrController;
  bool scanned = false;
  String? targetUrl;
  String? _peerId;
  String? _serverRoot;
  RTCPeerConnection? _peer;
  MediaStream? _localStream;
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  Timer? _answerTimer;
  Timer? _iceTimer;

  @override
  void initState() {
    super.initState();
    _localRenderer.initialize();
  }

  @override
  void dispose() {
    qrController?.dispose();
    _answerTimer?.cancel();
    _iceTimer?.cancel();
    _peer?.close();
    _localRenderer.dispose();
    super.dispose();
  }

  void _onQRViewCreated(QRViewController controller) {
    qrController = controller;
    controller.scannedDataStream.listen((scanData) {
      if (!scanned) {
        setState(() {
          scanned = true;
          targetUrl = scanData.code;
          // Parse peerId et racine serveur depuis l'URL QR
          final uri = Uri.tryParse(targetUrl ?? '');
          _peerId = uri?.queryParameters['peerId'] ?? DateTime.now().millisecondsSinceEpoch.toString();
          _serverRoot = uri != null ? '${uri.scheme}://${uri.host}:${uri.port}' : null;
          print('[MOBILE] Utilisation du peerId: $_peerId');
        });
        controller.pauseCamera();
        _startWebRTC();
      }
    });
  }

  Future<void> _startWebRTC() async {
    final mediaConstraints = {
      'audio': false,
      'video': {'facingMode': 'environment'}
    };
    _localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    _localRenderer.srcObject = _localStream;
    final config = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'}
      ]
    };
    _peer = await createPeerConnection(config);
    _localStream?.getTracks().forEach((track) {
      _peer?.addTrack(track, _localStream!);
    });
    final offer = await _peer!.createOffer();
    await _peer!.setLocalDescription(offer);
    // Log avant POST de l'offre
    print('[MOBILE] POST OFFER: [36m$_serverRoot/api/offer/$_peerId[0m');
	
	try {
	  final resp = await http.post(
		Uri.parse('$_serverRoot/api/offer/${_peerId}'),
		headers: {'Content-Type': 'application/json'},
		body: json.encode(offer.toMap()),
	  );
	  print('[MOBILE] POST OFFER status: ${resp.statusCode}, body: ${resp.body}');
	} catch (e) {
	  print('[MOBILE] POST OFFER error: $e');
	}
		
    _peer!.onIceCandidate = (RTCIceCandidate? cand) {
      if (cand != null) {
        print('[MOBILE] POST ICE: [36m$_serverRoot/api/ice-candidates/$_peerId[0m');
        http.post(Uri.parse('$_serverRoot/api/ice-candidates/${_peerId}'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'candidate': cand.candidate,
              'sdpMid': cand.sdpMid,
              'sdpMLineIndex': cand.sdpMLineIndex,
            }));
      }
    };
    _answerTimer = Timer.periodic(const Duration(seconds: 1), (t) async {
      print('[MOBILE] GET ANSWER: [36m$_serverRoot/api/answer/$_peerId[0m');
      final res = await http.get(Uri.parse('$_serverRoot/api/answer/${_peerId}'));
      if (res.statusCode == 200) {
        final ans = json.decode(res.body);
        await _peer!.setRemoteDescription(
            RTCSessionDescription(ans['sdp'], ans['type']));
        t.cancel();
      }
    });
    _iceTimer = Timer.periodic(const Duration(seconds: 1), (t) async {
      print('[MOBILE] GET ICE: [36m$_serverRoot/api/ice-candidates/$_peerId[0m');
      final r = await http
          .get(Uri.parse('$_serverRoot/api/ice-candidates/${_peerId}'));
      if (r.statusCode == 200) {
        final List list = json.decode(r.body);
        for (var c in list) {
          await _peer!.addCandidate(RTCIceCandidate(
              c['candidate'], c['sdpMid'], c['sdpMLineIndex']));
        }
      }
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('WiFi Webcam Streamer')),
        body: scanned ? _buildStreamView() : _buildQRView(),
      );

  Widget _buildQRView() => QRView(
        key: qrKey,
        onQRViewCreated: _onQRViewCreated,
        overlay: QrScannerOverlayShape(
            borderColor: Colors.blueAccent,
            borderRadius: 10,
            borderLength: 30,
            borderWidth: 10),
      );

  Widget _buildStreamView() => Column(
        children: [
          Expanded(child: RTCVideoView(_localRenderer, mirror: true)),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  icon: const Icon(Icons.cameraswitch),
                  label: const Text('Changer de caméra'),
                  onPressed: () async {
                    if (_localStream != null) {
                      final videoTrack = _localStream!.getVideoTracks().first;
                      await Helper.switchCamera(videoTrack);
                    }
                  },
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: ElevatedButton(
              onPressed: () {
                qrController?.resumeCamera();
                setState(() {
                  scanned = false;
                });
              },
              child: const Text('Scanner un autre QR code'),
            ),
          )
        ],
      );
}
