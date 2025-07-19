import { LogLevel } from "./src/@types";
import { GameLauncher } from "./src/core/GameLauncher";

async function testProtonFix() {
    console.log("🧪 Testing Proton Detection Fix");
    console.log("=" .repeat(40));
    
    const launcher = new GameLauncher({
        logging: {
          config: {
            level: LogLevel.DEBUG,
            enableConsole: true,
          },
          enabled: true,
        }
    });
    
    try {
        // Test if Proton is available
        const isProtonAvailable = await launcher.isProtonAvailable();
        console.log(`\n✅ Proton Available: ${isProtonAvailable}`);
        
        if (isProtonAvailable) {
            const protonManager = launcher.getProtonManager();
            if (protonManager) {
                // Get all installed builds
                const installedBuilds = await protonManager.getInstalledProtonBuilds();
                console.log(`\n📦 Found ${installedBuilds.length} Proton builds:`);
                
                installedBuilds.forEach(build => {
                    console.log(`  - ${build.variant}: ${build.version} (${build.installPath})`);
                });
                
                // Test specific GE-Proton10-9 detection
                const geProton = installedBuilds.find(b => 
                    b.variant === "proton-ge" && b.version === "GE-Proton10-9"
                );
                
                if (geProton) {
                    console.log(`\n🎯 Successfully found GE-Proton10-9:`);
                    console.log(`   Variant: ${geProton.variant}`);
                    console.log(`   Version: ${geProton.version}`);
                    console.log(`   Path: ${geProton.installPath}`);
                    console.log(`   Source: ${geProton.installSource}`);
                    
                    console.log(`\n✅ Fix verified: Proton detection is working correctly!`);
                } else {
                    console.log(`\n❌ GE-Proton10-9 not found in detected builds`);
                }
            }
        } else {
            console.log(`\n❌ Proton not available on this system`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error testing Proton fix:`, error);
    }
}

testProtonFix().catch(console.error);
