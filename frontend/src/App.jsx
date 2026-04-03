import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Upload, FileText, PieChart, Activity, ExternalLink, Trash2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState({ total_spend: 0, total_processed: 0, vendor_totals: {}, invoices: [] });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadResults([]);
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData);
      setUploadResults(response.data.results);
      fetchAnalytics();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportCSV = () => {
    const invoices = analytics.invoices;
    if (invoices.length === 0) return;

    const headers = ['ID', 'Vendor', 'Invoice Number', 'Date', 'Amount', 'Currency', 'Tax', 'Confidence', 'Status', 'File URL', 'Created At'];
    const rows = invoices.map(inv => [
      inv.id || '',
      inv.vendor_name || '',
      inv.invoice_number || '',
      inv.invoice_date || '',
      inv.total_amount ?? '',
      inv.currency || '',
      inv.tax_amount ?? '',
      inv.confidence_score != null ? (inv.confidence_score * 100).toFixed(0) + '%' : '',
      inv.status || '',
      inv.file_url || '',
      inv.created_at || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Delete this invoice record?')) return;
    try {
      await axios.delete(`${API_BASE}/invoices/${invoiceId}`);
      // Optimistically remove from local state
      setAnalytics(prev => ({
        ...prev,
        invoices: prev.invoices.filter(inv => inv.id !== invoiceId),
        total_processed: prev.total_processed - 1
      }));
      fetchAnalytics();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete invoice.');
    }
  };

  // Prepare data for charts
  const vendorChartData = Object.entries(analytics.vendor_totals).map(([name, total]) => ({
    name,
    total
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  const trendData = analytics.invoices.map(inv => ({
    date: new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: inv.total_amount || 0
  })).reverse();

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem' }}>Invoice AI</h1>
          <p style={{ color: 'var(--text-muted)' }}>Automated extraction, storage & analytics</p>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'card'}`} 
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'card'}`} 
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={20} /> Upload
          </button>
          <button 
            className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'card'}`} 
            onClick={() => setActiveTab('invoices')}
          >
            <FileText size={20} /> Invoices
          </button>
        </nav>
      </header>

      {/* DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          <div className="stats-grid">
            <div className="card stat-card">
              <span className="stat-label">Total Spend</span>
              <span className="stat-value">${analytics.total_spend.toLocaleString()}</span>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Processed</span>
              <span className="stat-value">{analytics.total_processed}</span>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Top Vendor</span>
              <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                {vendorChartData[0]?.name || 'N/A'}
              </span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card" style={{ height: '400px' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.25rem' }}>Spend by Vendor</h3>
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={vendorChartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ height: '400px' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.25rem' }}>Processing Trends</h3>
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={trendData}>
                    <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="var(--primary)" fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD VIEW */}
      {activeTab === 'upload' && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card">
            <h2>Process New Invoices</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Upload multiple PDF or images to extract structured data automatically.
            </p>
            
            <label className="upload-area" style={{ display: 'block' }}>
              <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'var(--glass)', padding: '1.5rem', borderRadius: '50%' }}>
                    <Upload size={48} color="var(--primary)" />
                </div>
                <p style={{ fontWeight: 500 }}>Click or drag files to upload</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>JPG, PNG, PDF supported</p>
              </div>
            </label>

            {isUploading && (
              <div style={{ marginTop: '2rem' }}>
                <p style={{ marginBottom: '0.5rem' }}>Extracting data using LLM API...</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '100%', animation: 'pulse 2s infinite' }}></div>
                </div>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Results</h3>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Status</th>
                        <th>Vendor</th>
                        <th>Total</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResults.map((res, i) => (
                        <tr key={res.filename + i}>
                          <td>{res.filename}</td>
                          <td>
                            <span style={{ color: res.status === 'success' ? 'var(--success)' : res.status === 'duplicate' ? 'orange' : 'var(--error)' }}>
                              {res.status}
                            </span>
                          </td>
                          <td colSpan={res.status !== 'success' ? 3 : 1}>
                            {res.status === 'success' ? (res.extracted_data?.vendor_name || '-') : res.message}
                          </td>
                          {res.status === 'success' && (
                            <>
                              <td>{res.extracted_data?.currency} {res.extracted_data?.total_amount}</td>
                              <td>
                                {res.extracted_data?.confidence_score ? 
                                    `${(res.extracted_data.confidence_score * 100).toFixed(0)}%` : '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVOICES LIST VIEW */}
      {activeTab === 'invoices' && (
        <div className="animate-fade-in card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Processed Invoices</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn card" style={{ padding: '0.5rem 1rem' }} onClick={handleExportCSV} disabled={analytics.invoices.length === 0}>
                    <Download size={18} /> Export CSV
                </button>
            </div>
          </div>
          
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Confidence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {analytics.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                        <div style={{ fontWeight: 600 }}>{inv.vendor_name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {inv.id.slice(0,8)}</div>
                    </td>
                    <td>{inv.invoice_number || '-'}</td>
                    <td>{inv.invoice_date || '-'}</td>
                    <td>{inv.currency} {inv.total_amount?.toLocaleString()}</td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="progress-bar" style={{ width: '60px', marginTop: 0 }}>
                                <div 
                                    className="progress-fill" 
                                    style={{ 
                                        width: `${(inv.confidence_score || 0.8) * 100}%`,
                                        background: (inv.confidence_score || 0.8) > 0.8 ? 'var(--success)' : 'orange'
                                    }}
                                ></div>
                            </div>
                            <span style={{ fontSize: '0.875rem' }}>
                                {(inv.confidence_score * 100).toFixed(0)}%
                            </span>
                        </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href={inv.file_url} target="_blank" rel="noreferrer" className="btn card" style={{ padding: '0.5rem' }} title="View Original">
                          <ExternalLink size={16} />
                        </a>
                        <button className="btn card" style={{ padding: '0.5rem' }} title="Delete Record" onClick={() => handleDeleteInvoice(inv.id)}>
                          <Trash2 size={16} color="var(--error)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {analytics.invoices.length === 0 && (
                   <tr>
                     <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No invoices found. Go to Upload to start processing.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export default App;
