import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'connect', loadComponent: () => import('./features/pairing/connect-page.component').then(m => m.ConnectPageComponent) },
  { path: '', loadComponent: () => import('./features/controller/pages/controller-page/controller-page.component').then(module => module.ControllerPageComponent) },
  { path: '**', redirectTo: '' }
];
