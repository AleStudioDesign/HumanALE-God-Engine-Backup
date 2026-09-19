import 'package:flutter/material.dart';

enum AssistantMode { idle, fetching, thinking, completed }

class AvatarHeader extends StatelessWidget {
  final AssistantMode mode;
  final String statusDescription;

  const AvatarHeader({
    super.key,
    required this.mode,
    required this.statusDescription,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true, // Screen reader otomatis mengumumkan pembaruan status
      label: 'Asisten AI Aktif. Status saat ini: $statusDescription',
      child: Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFF06B6D4), Color(0xFF8B5CF6)],
                ),
              ),
              child: const Icon(Icons.psychology, color: Colors.white, size: 32),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AURA Neural Assistant',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    statusDescription,
                    style: const TextStyle(color: Color(0xFFBAE6FD), fontSize: 14),
                  ),
                ],
              ),
            ),
            if (mode == AssistantMode.fetching || mode == AssistantMode.thinking)
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF38BDF8)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
