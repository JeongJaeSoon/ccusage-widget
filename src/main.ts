import { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = process.argv.includes('--dev');

interface WidgetConfig {
  alwaysOnTop: boolean;
  opacity: number;
  refreshInterval: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const config: WidgetConfig = {
  alwaysOnTop: true,
  opacity: 0.95,
  refreshInterval: 60000, // 1 minute
  position: 'top-right'
};

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  const windowWidth = 400;
  const windowHeight = 300;
  const minHeight = 200;
  const maxHeight = 600;
  
  let x = 0, y = 0;
  
  switch (config.position) {
    case 'top-right':
      x = screenWidth - windowWidth - 20;
      y = 20;
      break;
    case 'top-left':
      x = 20;
      y = 20;
      break;
    case 'bottom-right':
      x = screenWidth - windowWidth - 20;
      y = screenHeight - windowHeight - 20;
      break;
    case 'bottom-left':
      x = 20;
      y = screenHeight - windowHeight - 20;
      break;
  }

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: windowWidth,
    maxWidth: windowWidth,
    minHeight: minHeight,
    maxHeight: maxHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: config.alwaysOnTop,
    resizable: true,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'customButtonsOnHover',
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });

  mainWindow.setOpacity(config.opacity);

  const indexPath = isDev 
    ? path.join(__dirname, '..', 'src', 'index.html')
    : path.join(__dirname, 'index.html');
  
  console.log('Loading index.html from:', indexPath);
  console.log('__dirname:', __dirname);
  console.log('isDev:', isDev);
  
  mainWindow.loadFile(indexPath);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon-template.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: 'Hide Widget',
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Position',
      submenu: [
        {
          label: 'Top Right',
          type: 'radio',
          checked: config.position === 'top-right',
          click: () => updatePosition('top-right')
        },
        {
          label: 'Top Left',
          type: 'radio',
          checked: config.position === 'top-left',
          click: () => updatePosition('top-left')
        },
        {
          label: 'Bottom Right',
          type: 'radio',
          checked: config.position === 'bottom-right',
          click: () => updatePosition('bottom-right')
        },
        {
          label: 'Bottom Left',
          type: 'radio',
          checked: config.position === 'bottom-left',
          click: () => updatePosition('bottom-left')
        }
      ]
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: config.alwaysOnTop,
      click: (menuItem) => {
        config.alwaysOnTop = menuItem.checked;
        mainWindow?.setAlwaysOnTop(config.alwaysOnTop);
      }
    },
    { type: 'separator' },
    {
      label: 'Refresh Now',
      click: () => {
        mainWindow?.webContents.send('refresh-data');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('CCUsage Widget');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function updatePosition(position: WidgetConfig['position']) {
  config.position = position;
  if (mainWindow) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const [width, height] = mainWindow.getSize();
    
    let x = 0, y = 0;
    
    switch (position) {
      case 'top-right':
        x = screenWidth - width - 20;
        y = 20;
        break;
      case 'top-left':
        x = 20;
        y = 20;
        break;
      case 'bottom-right':
        x = screenWidth - width - 20;
        y = screenHeight - height - 20;
        break;
      case 'bottom-left':
        x = 20;
        y = screenHeight - height - 20;
        break;
    }
    
    mainWindow.setPosition(x, y);
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// IPC handlers for fetching usage data
ipcMain.handle('get-usage-data', async () => {
  try {
    // Execute ccusage commands to get data
    console.log('Executing ccusage commands...');
    // Try different ways to execute ccusage
    let dailyResult, monthlyResult, sessionResult, blocksResult;
    
    try {
      // First try with npx
      [dailyResult, monthlyResult, sessionResult, blocksResult] = await Promise.all([
        execAsync('npx ccusage daily --json'),
        execAsync('npx ccusage monthly --json'),
        execAsync('npx ccusage session --json'),
        execAsync('npx ccusage blocks --json')
      ]);
    } catch (error) {
      console.error('Failed with npx, trying direct ccusage:', error);
      // Try with direct ccusage command
      try {
        [dailyResult, monthlyResult, sessionResult, blocksResult] = await Promise.all([
          execAsync('ccusage daily --json'),
          execAsync('ccusage monthly --json'),
          execAsync('ccusage session --json'),
          execAsync('ccusage blocks --json')
        ]);
      } catch (error2) {
        console.error('Failed with direct ccusage, trying node_modules:', error2);
        // Try with local node_modules
        const ccusagePath = path.join(__dirname, '..', 'node_modules', '.bin', 'ccusage');
        [dailyResult, monthlyResult, sessionResult, blocksResult] = await Promise.all([
          execAsync(`${ccusagePath} daily --json`),
          execAsync(`${ccusagePath} monthly --json`),
          execAsync(`${ccusagePath} session --json`),
          execAsync(`${ccusagePath} blocks --json`)
        ]);
      }
    }
    
    console.log('Daily result:', dailyResult.stdout);
    console.log('Monthly result:', monthlyResult.stdout);
    console.log('Session result:', sessionResult.stdout);
    console.log('Blocks result:', blocksResult.stdout);

    let dailyData, monthlyData, sessionData, blocksData;
    
    try {
      const dailyParsed = JSON.parse(dailyResult.stdout || '{}');
      const monthlyParsed = JSON.parse(monthlyResult.stdout || '{}');
      const sessionParsed = JSON.parse(sessionResult.stdout || '{}');
      const blocksParsed = JSON.parse(blocksResult.stdout || '{}');
      
      console.log('Parsed daily data structure:', Object.keys(dailyParsed));
      console.log('Parsed monthly data structure:', Object.keys(monthlyParsed));
      console.log('Parsed session data structure:', Object.keys(sessionParsed));
      console.log('Parsed blocks data structure:', Object.keys(blocksParsed));
      
      // Adjust to actual ccusage output structure
      dailyData = dailyParsed;
      monthlyData = monthlyParsed;
      sessionData = sessionParsed;
      blocksData = blocksParsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw outputs:', {
        daily: dailyResult?.stdout,
        monthly: monthlyResult?.stdout,
        session: sessionResult?.stdout,
        blocks: blocksResult?.stdout
      });
      throw new Error('Failed to parse ccusage output');
    }

    // Get today's usage (find today's date in the array)
    // Use local date to match ccusage output
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    const dailyArray = dailyData.daily || dailyData.data || [];
    console.log('Looking for today (local):', todayDate);
    console.log('Available dates:', dailyArray.map((d: any) => d.date));
    
    // Find today's data or get the most recent day
    let today = dailyArray.find((d: any) => d.date === todayDate);
    
    // If today's data is not found, get the most recent (last item in array)
    if (!today && dailyArray.length > 0) {
      today = dailyArray[dailyArray.length - 1];
      console.log('Today not found, using most recent:', today.date);
    }
    
    console.log('Today data:', today);
    
    // Get this month's usage
    const thisMonthDate = new Date().toISOString().substring(0, 7); // YYYY-MM format
    const monthlyArray = monthlyData.monthly || monthlyData.data || [];
    const thisMonth = monthlyArray.find((m: any) => m.month === thisMonthDate) || monthlyArray[0] || null;
    console.log('This month data:', thisMonth);
    
    // Get total from summary
    const totalDaily = dailyData.totals || dailyData.summary || {};
    console.log('Total daily:', totalDaily);

    // Get recent sessions
    const sessionsArray = sessionData.sessions || sessionData.data || [];
    console.log('Sessions array:', sessionsArray);
    
    const recentSessions = sessionsArray.slice(0, 5).map((s: any) => {
      console.log('Session item:', s);
      return {
        name: s.sessionName || s.session || s.name || 'Unknown Session',
        tokens: s.totalTokens || 0,
        cost: s.totalCost || s.costUSD || s.totalCostUSD || 0,
        lastActivity: s.lastActivity || s.lastUpdated || new Date().toISOString()
      };
    });

    // Get blocks data
    const blocksArray = Array.isArray(blocksData.blocks) ? blocksData.blocks : [];
    console.log('Blocks array:', blocksArray);
    
    // Find current active block
    const currentBlock = blocksArray.find((block: any) => 
      block && typeof block === 'object' && block.isActive === true
    );
    console.log('Current active block:', currentBlock);
    const result = {
      today: today ? {
        date: today.date,
        tokens: today.totalTokens,
        cost: today.totalCost || today.costUSD || today.totalCostUSD,
        models: today.modelsUsed || today.models || []
      } : null,
      thisMonth: thisMonth ? {
        tokens: thisMonth.totalTokens,
        cost: thisMonth.totalCost || thisMonth.costUSD || thisMonth.totalCostUSD
      } : null,
      total: {
        tokens: totalDaily.totalTokens || 0,
        cost: totalDaily.totalCost || totalDaily.totalCostUSD || 0
      },
      currentBlock: currentBlock ? {
        tokens: (currentBlock.tokenCounts?.inputTokens || 0) + (currentBlock.tokenCounts?.outputTokens || 0),
        cost: currentBlock.costUSD || 0,
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        isActive: true
      } : null,
      recentSessions,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('Returning result:', result);
    return result;
  } catch (error) {
    console.error('Error loading usage data:', error);
    // Return empty data instead of throwing
    return {
      today: null,
      thisMonth: null,
      total: {
        tokens: 0,
        cost: 0
      },
      currentBlock: null,
      recentSessions: [],
      lastUpdated: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle('update-opacity', async (_, opacity: number) => {
  config.opacity = opacity;
  mainWindow?.setOpacity(opacity);
});