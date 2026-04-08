import './globals.css';

export const metadata = {
  title: 'Painel de Compras | Bling Dashboard',
  description: 'Relatório automatizado de compras integrado com o Bling ERP',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
