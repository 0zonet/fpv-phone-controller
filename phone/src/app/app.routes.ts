import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/controller/pages/controller-page/controller-page.component').then(module => module.ControllerPageComponent) },
  { path: '**', redirectTo: '' }
];
