import { Supabase } from '../auth/supabase';
import { SpotManager } from './SpotManager';

const auth    = new Supabase();
const manager = new SpotManager(auth);
manager.mount(document.getElementById('app')!);
