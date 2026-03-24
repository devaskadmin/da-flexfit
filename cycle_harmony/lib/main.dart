import 'package:flutter/material.dart';

void main() => runApp(const CycleHarmonyApp());

class CycleHarmonyApp extends StatelessWidget {
  const CycleHarmonyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cycle Harmony',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.pinkAccent),
        useMaterial3: true,
      ),
      home: const CycleHarmonyHome(),
    );
  }
}

class CycleHarmonyHome extends StatelessWidget {
  const CycleHarmonyHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cycle Harmony')),
      body: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.favorite, size: 80, color: Colors.pinkAccent),
            SizedBox(height: 16),
            Text('Welcome to Cycle Harmony', style: TextStyle(fontSize: 20)),
          ],
        ),
      ),
    );
  }
}
