import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

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
          print('[MOBILE][QR] QR scanné: $targetUrl');
          print('[MOBILE][QR] peerId extrait: $_peerId');
          print('[MOBILE][QR] serverRoot extrait: $_serverRoot');
        });
        controller.pauseCamera();
        _checkWiFiAndStartWebRTC(context);
      }
    });
  }

  Future<void> _checkWiFiAndStartWebRTC(BuildContext context) async {
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult != ConnectivityResult.wifi) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Icon(Icons.signal_wifi_off, color: Colors.white, size: 32),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          elevation: 8,
        ),
      );
      return;
    }
    _startWebRTC();
  }

  Future<void> _startWebRTC() async {
    final mediaConstraints = {
      'audio': false,
      'video': {'facingMode': 'environment'}
    };
    print('[MOBILE][WEBRTC] Obtention du flux média local...');
    _localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    _localRenderer.srcObject = _localStream;
    final config = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'}
      ]
    };
    print('[MOBILE][WEBRTC] Création de la connexion peer...');
    _peer = await createPeerConnection(config);
    _peer?.onIceCandidate = (RTCIceCandidate candidate) async {
      print('[MOBILE][WEBRTC] ICE candidate généré: ${candidate.candidate}');
      if (_serverRoot != null && _peerId != null) {
        final url = '${_serverRoot}/api/ice-candidates/${_peerId}';
        try {
          final resp = await http.post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'candidate': candidate.candidate,
              'sdpMid': candidate.sdpMid,
              'sdpMLineIndex': candidate.sdpMLineIndex,
            }),
          );
          print('[MOBILE][WEBRTC] POST ICE status: ${resp.statusCode}, body: ${resp.body}');
          if (resp.statusCode != 200) {
            print('[MOBILE][WEBRTC][ERREUR] POST ICE a échoué avec status ${resp.statusCode}: ${resp.body}');
          }
        } catch (e) {
          print('[MOBILE][WEBRTC][ERREUR] POST ICE: ${e}');
        }
      }
    };
    _localStream?.getTracks().forEach((track) {
      _peer?.addTrack(track, _localStream!);
    });
    final offer = await _peer!.createOffer();
    await _peer!.setLocalDescription(offer);
    print('[MOBILE][WEBRTC] Offre créée. peerId: [33m[1m[4m$_peerId[0m');
    print('[MOBILE][WEBRTC] Contenu de l\'offre: [36m${json.encode(offer.toMap())}[0m');
    if (_serverRoot == null || _peerId == null) {
      print('[MOBILE][WEBRTC][ERREUR] serverRoot ou peerId est null. Impossible d\'envoyer l\'offre.');
      return;
    }
    final offerUrl = '$_serverRoot/api/offer/${_peerId}';
    print('[MOBILE][WEBRTC] POST OFFER: $offerUrl');
    try {
      final resp = await http.post(
        Uri.parse(offerUrl),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(offer.toMap()),
      );
      print('[MOBILE][WEBRTC] POST OFFER status: ${resp.statusCode}, body: ${resp.body}');
      if (resp.statusCode != 200) {
        print('[MOBILE][WEBRTC][ERREUR] POST OFFER a échoué avec status ${resp.statusCode}: ${resp.body}');
      }
    } catch (e, st) {
      print('[MOBILE][WEBRTC][ERREUR] Exception lors du POST OFFER: $e\n$st');
    }
    _peer!.onIceCandidate = (RTCIceCandidate? cand) {
      if (cand != null) {
        print('[MOBILE][WEBRTC] POST ICE: $_serverRoot/api/ice-candidates/$_peerId');
        http.post(Uri.parse('$_serverRoot/api/ice-candidates/${_peerId}'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'candidate': cand.candidate,
              'sdpMid': cand.sdpMid,
              'sdpMLineIndex': cand.sdpMLineIndex,
            })).then((resp) {
          print('[MOBILE][WEBRTC] POST ICE status: ${resp.statusCode}, body: ${resp.body}');
        }).catchError((e) {
          print('[MOBILE][WEBRTC] POST ICE error: $e');
        });
      }
    };
    _answerTimer = Timer.periodic(const Duration(seconds: 1), (t) async {
      print('[MOBILE][WEBRTC] GET ANSWER: $_serverRoot/api/answer/$_peerId');
      try {
        final res = await http.get(Uri.parse('$_serverRoot/api/answer/${_peerId}'));
        print('[MOBILE][WEBRTC] GET ANSWER status: ${res.statusCode}, body: ${res.body}');
        if (res.statusCode == 200) {
          final ans = json.decode(res.body);
          await _peer!.setRemoteDescription(
              RTCSessionDescription(ans['sdp'], ans['type']));
          print('[MOBILE][WEBRTC] Réponse reçue et appliquée.');
          t.cancel();
        }
      } catch (e) {
        print('[MOBILE][WEBRTC] GET ANSWER error: $e');
      }
    });
    _iceTimer = Timer.periodic(const Duration(seconds: 1), (t) async {
      print('[MOBILE][WEBRTC] GET ICE: $_serverRoot/api/ice-candidates/$_peerId');
      try {
        final r = await http.get(Uri.parse('$_serverRoot/api/ice-candidates/${_peerId}'));
        print('[MOBILE][WEBRTC] GET ICE status: ${r.statusCode}, body: ${r.body}');
        if (r.statusCode == 200) {
          final List list = json.decode(r.body);
          for (var c in list) {
            await _peer!.addCandidate(RTCIceCandidate(
                c['candidate'], c['sdpMid'], c['sdpMLineIndex']));
          }
        }
      } catch (e) {
        print('[MOBILE][WEBRTC] GET ICE error: $e');
      }
    });
    setState(() {});
  }

  @override
  void reassemble() {
    super.reassemble();
    if (qrController != null) {
      if (defaultTargetPlatform == TargetPlatform.android) {
        qrController!.pauseCamera();
      }
      qrController!.resumeCamera();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('WiFi Webcam Streamer'),
          actions: [
            IconButton(
              icon: const Icon(Icons.close),
              tooltip: 'Fermer',
              onPressed: () {
                // Ferme l'application mobile
                // Utilise SystemNavigator.pop() pour Android/iOS
                SystemNavigator.pop();
              },
            ),
          ],
        ),
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

  Widget _buildStreamView() => Stack(
        children: [
          Positioned.fill(
            child: RTCVideoView(_localRenderer, mirror: false),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: Material(
              color: Colors.transparent,
              child: IconButton(
                icon: const Icon(Icons.cameraswitch, color: Colors.white, size: 32),
                onPressed: () async {
                  if (_localStream != null) {
                    final videoTrack = _localStream!.getVideoTracks().first;
                    await Helper.switchCamera(videoTrack);
                  }
                },
                tooltip: 'Changer de caméra',
              ),
            ),
          ),
        ],
      );
}
