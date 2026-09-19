import 'dart:convert';
import 'package:http/http.dart' as http;

enum AiProvider { gemini, chatGpt }

class AiOrchestrator {
  final String geminiApiKey;
  final String openAiApiKey;

  AiOrchestrator({required this.geminiApiKey, required this.openAiApiKey});

  /// Analisis email dan rekomendasi balasan menggunakan Gemini
  Future<String> analyzeAndDraftWithGemini({
    required String sender,
    required String subject,
    required String body,
  }) async {
    final url = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$geminiApiKey',
    );

    final prompt = '''
Anda adalah asisten kerja digital. Analisis email berikut:
Pengirim: $sender
Subjek: $subject
Isi: $body

Tugas:
1. Ringkas intisari email (1-2 kalimat).
2. Tentukan tingkat urgensi (Tinggi / Sedang / Rendah).
3. Buatkan draf balasan profesional dan ramah yang siap dikirim.
''';

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [{'text': prompt}]
          }
        ]
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['candidates']?[0]?['content']?['parts']?[0]?['text'] ?? 'Tidak ada respons';
    } else {
      throw Exception('Gagal memproses dengan Gemini: ${response.body}');
    }
  }

  /// Opsi pemrosesan kode/analisis teknis via OpenAI (ChatGPT/Codex)
  Future<String> processWithChatGPT(String prompt) async {
    final url = Uri.parse('https://api.openai.com/v1/chat/completions');

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $openAiApiKey',
      },
      body: jsonEncode({
        'model': 'gpt-4o-mini',
        'messages': [
          {'role': 'system', 'content': 'Anda adalah asisten teknis AI cerdas.'},
          {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.3,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['choices']?[0]?['message']?['content'] ?? '';
    } else {
      throw Exception('Gagal memproses dengan OpenAI: ${response.body}');
    }
  }
}
