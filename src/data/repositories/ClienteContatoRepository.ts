/**
 * ClienteContatoRepository — agenda de clientes do barbeiro
 * (`barbeiros/{barbeiroId}/clientes/{id}`), cadastrados manualmente ou
 * importados da agenda de contatos do telefone.
 *
 * Independente da coleção `usuarios`: não exige que o cliente tenha conta
 * no app. Serve de base para uma futura tela de "agendamento manual pelo
 * barbeiro" e para ativação rápida de base de clientes já existente.
 */
import { db } from '../../../firebaseConfig';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { ClienteContato } from '../../types';

const clientesRef = (barbeiroId: string) =>
  collection(db, 'barbeiros', barbeiroId, 'clientes');

/**
 * Lista os clientes cadastrados pelo barbeiro, mais recentes primeiro.
 */
export async function listarClientesDoBarbeiro(
  barbeiroId?: string | null,
): Promise<ClienteContato[]> {
  if (!barbeiroId) return [];
  const snap = await getDocs(query(clientesRef(barbeiroId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<ClienteContato, 'id'>), id: d.id }));
}

/**
 * Cadastra um cliente manualmente.
 */
export async function adicionarClienteManual(
  barbeiroId: string,
  dados: { nome: string; telefone?: string },
): Promise<string> {
  const docRef = await addDoc(clientesRef(barbeiroId), {
    nome: dados.nome,
    telefone: dados.telefone || null,
    origem: 'manual',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Importa vários contatos de uma vez (ex.: da agenda do telefone).
 * Usa um batch write para evitar N round-trips ao Firestore.
 * Limite de 400 por chamada (margem de segurança sobre o limite de 500
 * operações por batch do Firestore).
 */
export async function importarClientesEmLote(
  barbeiroId: string,
  contatos: Array<{ nome: string; telefone?: string }>,
): Promise<number> {
  if (contatos.length === 0) return 0;

  const lote = contatos.slice(0, 400);
  const batch = writeBatch(db);

  for (const contato of lote) {
    const novoDoc = doc(clientesRef(barbeiroId));
    batch.set(novoDoc, {
      nome: contato.nome,
      telefone: contato.telefone || null,
      origem: 'contatos',
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return lote.length;
}

/**
 * Remove um cliente da agenda do barbeiro.
 */
export async function removerCliente(barbeiroId: string, clienteId: string): Promise<void> {
  await deleteDoc(doc(db, 'barbeiros', barbeiroId, 'clientes', clienteId));
}
