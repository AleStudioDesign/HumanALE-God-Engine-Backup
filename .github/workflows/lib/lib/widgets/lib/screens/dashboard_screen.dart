import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/email_task.dart';
import '../services/ai_orchestrator.dart';
import '../services/gmail_service.dart';
import '../widgets/avatar_header.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final GmailService _gmailService = GmailService();
  late final AiOrchestrator _ai;

  AssistantMode _mode = AssistantMode.idle;
  String _statusMsg = "Siap membantu mengelola email dan pekerjaan Anda.";
  List<EmailTask> _tasks = [];
  bool _isSignedIn = false;

  @override
  void initState() {
    super.initState();
    _ai = AiOrchestrator(
      geminiApiKey: dotenv.env['GEMINI_API_KEY'] ?? '',
      openAiApiKey: dotenv.env['OPENAI_API_KEY'] ?? '',
    );
  }

  Future<void> _handleSignIn() async {
    setState(() {
      _mode = AssistantMode.fetching;
      _statusMsg = "Menghubungkan ke akun Gmail...";
    });

    final ok = await _gmailService.signIn();
    if (ok) {
      setState(() {
        _isSignedIn = true;
        _mode = AssistantMode.idle;
        _statusMsg = "Akun Gmail terhubung. Siap membaca pesan baru.";
      });
      _loadEmails();
    } else {
      setState(() {
        _mode = AssistantMode.idle;
        _statusMsg = "Gagal menghubungkan akun Google.";
      });
    }
  }

  Future<void> _loadEmails() async {
    setState(() {
      _mode = AssistantMode.fetching;
      _statusMsg = "Mengambil daftar email belum terbaca...";
    });

    try {
      final emails = await _gmailService.fetchUnreadTasks(limit: 4);
      setState(() {
        _tasks = emails;
        _mode = AssistantMode.idle;
        _statusMsg = "Ditemukan ${_tasks.length} email belum dibaca.";
      });
    } catch (e) {
      setState(() {
        _mode = AssistantMode.idle;
        _statusMsg = "Error: $e";
      });
    }
  }

  Future<void> _processEmail(EmailTask task) async {
    setState(() {
      task.isProcessing = true;
      _mode = AssistantMode.thinking;
      _statusMsg = "Aura sedang menganalisis email dari ${task.sender}...";
    });

    try {
      final result = await _ai.analyzeEmailWithGemini(
        sender: task.sender,
        subject: task.subject,
        content: task.snippet,
      );

      setState(() {
        task.aiSummary = result.summary;
        task.urgency = result.urgency;
        task.aiDraftReply = result.draftReply;
        task.isProcessing = false;
        _mode = AssistantMode.completed;
        _statusMsg = "Analisis selesai untuk: ${task.subject}";
      });
    } catch (e) {
      setState(() {
        task.isProcessing = false;
        _mode = AssistantMode.idle;
        _statusMsg = "Gagal menganalisis: $e";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Work Assistant'),
        backgroundColor: const Color(0xFF0F172A),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              AvatarHeader(mode: _mode, statusDescription: _statusMsg),
              const SizedBox(height: 16),
              if (!_isSignedIn)
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50), // Memenuhi standar tap target 48dp+
                  ),
                  onPressed: _handleSignIn,
                  icon: const Icon(Icons.mail),
                  label: const Text('Hubungkan Gmail'),
                )
              else
                Expanded(
                  child: ListView.separated(
                    itemCount: _tasks.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final t = _tasks[i];
                      return Card(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.subject, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              Text("Dari: ${t.sender}", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                              const SizedBox(height: 6),
                              Text(t.snippet, maxLines: 2, overflow: TextOverflow.ellipsis),
                              if (t.aiSummary != null) ...[
                                const Divider(),
                                Text("💡 Ringkasan AI: ${t.aiSummary}", style: const TextStyle(color: Colors.teal)),
                                const SizedBox(height: 4),
                                Text("✉️ Draf Balasan:\n${t.aiDraftReply}", style: const TextStyle(fontStyle: FontStyle.italic)),
                              ],
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerRight,
                                child: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    minimumSize: const Size(120, 48), // Target sentuh aksesibel
                                  ),
                                  onPressed: t.isProcessing ? null : () => _processEmail(t),
                                  child: t.isProcessing
                                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Text("Analisis & Draf"),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
