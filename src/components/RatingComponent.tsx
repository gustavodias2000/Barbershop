import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert
} from 'react-native';
import { db, auth } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { atualizarStatus } from '../data/repositories/AgendamentoRepository';
import type { Agendamento } from '../types';

interface RatingComponentProps {
  visible: boolean;
  onClose: () => void;
  agendamento: Agendamento | null;
}

export default function RatingComponent({
  visible,
  onClose,
  agendamento,
}: RatingComponentProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submitRating = async () => {
    if (!agendamento) return;
    if (rating === 0) {
      Alert.alert('Erro', 'Por favor, selecione uma avaliação.');
      return;
    }

    setLoading(true);
    try {
      // Salvar avaliação
      await addDoc(collection(db, 'avaliacoes'), {
        agendamentoId: agendamento.id,
        barbeiroId: agendamento.barbeiroId,
        barbeiroNome: agendamento.barbeiroNome,
        cliente: auth.currentUser?.email,
        clienteNome: agendamento.clienteNome,
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      });

      // Atualizar status do agendamento via repository
      await atualizarStatus(agendamento.id, 'avaliado', { rating });

      Alert.alert('Sucesso!', 'Avaliação enviada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`Avaliar com ${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
            accessibilityState={{ selected: star <= rating }}
          >
            <Text style={[
              styles.star,
              star <= rating && styles.starFilled
            ]}>
              ⭐
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Avaliar Atendimento</Text>
          <Text style={styles.subtitle}>
            Como foi seu atendimento com {agendamento?.barbeiroNome}?
          </Text>

          {renderStars()}

          <TextInput
            style={styles.commentInput}
            placeholder="Deixe um comentário (opcional)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={submitRating}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Enviando...' : 'Enviar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    width: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  starButton: {
    padding: 5,
  },
  star: {
    fontSize: 30,
    color: '#ddd',
  },
  starFilled: {
    color: '#f39c12',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    minHeight: 80,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ecf0f1',
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3498db',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});