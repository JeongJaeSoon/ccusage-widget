// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
  ccusageAPI: {
      getUsageData: () => Promise<{
        today: {
          date?: string;
          tokens: number;
          cost: number;
          models: string[];
        } | null;
        thisMonth: {
          tokens: number;
          cost: number;
        } | null;
        total: {
          tokens: number;
          cost: number;
        };
        currentBlock: {
          tokens: number;
          cost: number;
          startTime: string;
          endTime: string;
          isActive: boolean;
        } | null;
        recentSessions: Array<{
          name: string;
          tokens: number;
          cost: number;
          lastActivity: string;
        }>;
        lastUpdated: string;
      }>;
      updateOpacity: (opacity: number) => Promise<void>;
      onRefreshData: (callback: () => void) => () => void;
  };
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

const formatCost = (cost: number): string => {
  return '$' + cost.toFixed(2);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins + 'm ago';
  } else if (diffHours < 24) {
    return diffHours + 'h ago';
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return diffDays + 'd ago';
  }
};

const formatModels = (models: string[]): string => {
  return models.map(m => {
    if (m.includes('opus')) return 'Opus';
    if (m.includes('sonnet')) return 'Sonnet';
    if (m.includes('haiku')) return 'Haiku';
    return m;
  }).join(', ');
};


const formatBlockTime = (startTime: string, endTime: string): string => {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid time range';
    }

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
  } catch (error) {
    console.error('Error formatting block time:', error);
    return 'Invalid time range';
  }
};

const formatDateLabel = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

async function loadUsageData() {
  const loadingEl = document.getElementById('loading')!;
  const errorEl = document.getElementById('error')!;
  const statsEl = document.getElementById('usage-stats')!;
  
  try {
    loadingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    statsEl.style.display = 'none';
    
    const data = await window.ccusageAPI.getUsageData();
    
    // Update today's stats
    if (data.today) {
      document.getElementById('today-tokens')!.textContent = formatNumber(data.today.tokens);
      document.getElementById('today-cost')!.textContent = formatCost(data.today.cost);
      document.getElementById('today-models')!.textContent = formatModels(data.today.models);
      
      // Update label if not today
      const todayDate = new Date().toISOString().split('T')[0];
      if (data.today.date && data.today.date !== todayDate) {
        const dateLabel = document.querySelector('.today .stat-label');
        if (dateLabel) {
          dateLabel.textContent = formatDateLabel(data.today.date);
        }
      }
    } else {
      document.getElementById('today-tokens')!.textContent = '0';
      document.getElementById('today-cost')!.textContent = '$0.00';
      document.getElementById('today-models')!.textContent = 'No usage';
    }
    
    // Update this month's stats
    if (data.thisMonth) {
      document.getElementById('month-tokens')!.textContent = formatNumber(data.thisMonth.tokens);
      document.getElementById('month-cost')!.textContent = formatCost(data.thisMonth.cost);
    } else {
      document.getElementById('month-tokens')!.textContent = '0';
      document.getElementById('month-cost')!.textContent = '$0.00';
    }
    
    // Update total stats
    document.getElementById('total-tokens')!.textContent = formatNumber(data.total.tokens);
    document.getElementById('total-cost')!.textContent = formatCost(data.total.cost);
    
    // Update current block stats
    if (data.currentBlock) {
      document.getElementById('blocks-total')!.textContent = formatNumber(data.currentBlock.tokens);
      document.getElementById('blocks-cost')!.textContent = formatCost(data.currentBlock.cost);
      document.getElementById('blocks-time')!.textContent = formatBlockTime(data.currentBlock.startTime, data.currentBlock.endTime);
    } else {
      document.getElementById('blocks-total')!.textContent = '0';
      document.getElementById('blocks-cost')!.textContent = '$0.00';
      document.getElementById('blocks-time')!.textContent = 'No active block';
    }
    
    // Update recent sessions
    const sessionsList = document.getElementById('sessions-list')!;
    sessionsList.innerHTML = '';
    
    console.log('Recent sessions data:', data.recentSessions);
    
    if (data.recentSessions && data.recentSessions.length > 0) {
      let sessionsAdded = 0;
      
      data.recentSessions.forEach((session: any) => {
        console.log('Processing session:', session);
        
        // More lenient check - just need a name
        if (session && session.name) {
          const sessionEl = document.createElement('div');
          sessionEl.className = 'session-item';
          
          // Format session name for display - capitalize first letter
          let displayName = session.name;
          if (displayName === 'Unknown Session') {
            displayName = 'session';
          }
          
          // Capitalize first letter for better display
          displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
          
          sessionEl.innerHTML = `
            <span class="session-name" title="${displayName}">${displayName}</span>
            <span class="session-cost">${formatCost(session.cost || 0)}</span>
          `;
          sessionsList.appendChild(sessionEl);
          sessionsAdded++;
        }
      });
      
      // If no valid sessions were added
      if (sessionsAdded === 0) {
        sessionsList.innerHTML = '<div style="text-align: center; color: #666;">No session data available</div>';
      }
    } else {
      sessionsList.innerHTML = '<div style="text-align: center; color: #666;">No recent sessions</div>';
    }
    
    // Update last updated time
    document.getElementById('last-updated')!.textContent = 'Updated ' + formatDate(data.lastUpdated);
    
    loadingEl.style.display = 'none';
    statsEl.style.display = 'flex';
    
  } catch (error: any) {
    console.error('Error loading usage data:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    
    // Check if there's an error message in the data
    if (error && error.error) {
      document.getElementById('error-message')!.textContent = error.error;
    } else {
      document.getElementById('error-message')!.textContent = 
        error instanceof Error ? error.message : 'Failed to load usage data';
    }
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  loadUsageData();
  
  // Refresh button
  document.getElementById('refresh-btn')!.addEventListener('click', loadUsageData);
  
  // Minimize button
  document.getElementById('minimize-btn')!.addEventListener('click', () => {
    window.close();
  });
  
  // Opacity slider
  const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
  opacitySlider.addEventListener('input', (e) => {
    const opacity = parseInt((e.target as HTMLInputElement).value) / 100;
    window.ccusageAPI.updateOpacity(opacity);
  });
  
  // Listen for refresh events from main process
  window.ccusageAPI.onRefreshData(() => {
    loadUsageData();
  });
  
  // Auto-refresh every minute
  setInterval(loadUsageData, 60000);
});