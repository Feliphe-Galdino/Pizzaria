-- StarterGui/InterfaceDeStatus (LocalScript)
-- Monta a GUI de status (Nível, barra de XP, Mortes) e mostra avisos de XP ganho / level up.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local jogador = Players.LocalPlayer

local eventoInimigoMorto = ReplicatedStorage:WaitForChild("InimigoMorto")
local eventoSubiuDeNivel = ReplicatedStorage:WaitForChild("SubiuDeNivel")

local tela = Instance.new("ScreenGui")
tela.Name = "InterfaceDeStatus"
tela.ResetOnSpawn = false
tela.Parent = jogador:WaitForChild("PlayerGui")

local painel = Instance.new("Frame")
painel.Name = "Painel"
painel.Size = UDim2.new(0, 240, 0, 90)
painel.Position = UDim2.new(0, 20, 0, 20)
painel.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
painel.BackgroundTransparency = 0.25
painel.BorderSizePixel = 0
painel.Parent = tela

Instance.new("UICorner", painel).CornerRadius = UDim.new(0, 10)

local textoNivel = Instance.new("TextLabel")
textoNivel.Name = "TextoNivel"
textoNivel.Size = UDim2.new(1, -20, 0, 24)
textoNivel.Position = UDim2.new(0, 10, 0, 6)
textoNivel.BackgroundTransparency = 1
textoNivel.Font = Enum.Font.GothamBold
textoNivel.TextSize = 18
textoNivel.TextColor3 = Color3.fromRGB(255, 255, 255)
textoNivel.TextXAlignment = Enum.TextXAlignment.Left
textoNivel.Text = "Nível 1"
textoNivel.Parent = painel

local fundoBarraXP = Instance.new("Frame")
fundoBarraXP.Name = "FundoBarraXP"
fundoBarraXP.Size = UDim2.new(1, -20, 0, 14)
fundoBarraXP.Position = UDim2.new(0, 10, 0, 34)
fundoBarraXP.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
fundoBarraXP.BorderSizePixel = 0
fundoBarraXP.Parent = painel
Instance.new("UICorner", fundoBarraXP).CornerRadius = UDim.new(0, 6)

local barraXP = Instance.new("Frame")
barraXP.Name = "BarraXP"
barraXP.Size = UDim2.new(0, 0, 1, 0)
barraXP.BackgroundColor3 = Color3.fromRGB(70, 160, 255)
barraXP.BorderSizePixel = 0
barraXP.Parent = fundoBarraXP
Instance.new("UICorner", barraXP).CornerRadius = UDim.new(0, 6)

local textoMortes = Instance.new("TextLabel")
textoMortes.Name = "TextoMortes"
textoMortes.Size = UDim2.new(1, -20, 0, 20)
textoMortes.Position = UDim2.new(0, 10, 0, 54)
textoMortes.BackgroundTransparency = 1
textoMortes.Font = Enum.Font.Gotham
textoMortes.TextSize = 14
textoMortes.TextColor3 = Color3.fromRGB(220, 220, 220)
textoMortes.TextXAlignment = Enum.TextXAlignment.Left
textoMortes.Text = "Inimigos derrotados: 0"
textoMortes.Parent = painel

local function xpNecessarioParaNivel(nivel)
	return nivel * 100
end

local function atualizarInterface()
	local leaderstats = jogador:WaitForChild("leaderstats")
	local nivel = leaderstats:WaitForChild("Nível")
	local xp = leaderstats:WaitForChild("XP")
	local mortes = leaderstats:WaitForChild("Mortes")

	local function atualizar()
		textoNivel.Text = "Nível " .. nivel.Value
		textoMortes.Text = "Inimigos derrotados: " .. mortes.Value

		local proporcao = math.clamp(xp.Value / xpNecessarioParaNivel(nivel.Value), 0, 1)
		TweenService:Create(barraXP, TweenInfo.new(0.3), { Size = UDim2.new(proporcao, 0, 1, 0) }):Play()
	end

	nivel:GetPropertyChangedSignal("Value"):Connect(atualizar)
	xp:GetPropertyChangedSignal("Value"):Connect(atualizar)
	mortes:GetPropertyChangedSignal("Value"):Connect(atualizar)

	atualizar()
end

atualizarInterface()

eventoInimigoMorto.OnClientEvent:Connect(function(xpGanho)
	local aviso = Instance.new("TextLabel")
	aviso.Size = UDim2.new(0, 150, 0, 30)
	aviso.Position = UDim2.new(0, 40, 0, 110)
	aviso.BackgroundTransparency = 1
	aviso.Font = Enum.Font.GothamBold
	aviso.TextSize = 20
	aviso.TextColor3 = Color3.fromRGB(120, 255, 140)
	aviso.Text = "+" .. xpGanho .. " XP"
	aviso.Parent = tela

	local tween = TweenService:Create(aviso, TweenInfo.new(1.2), {
		Position = aviso.Position - UDim2.new(0, 0, 0, 40),
		TextTransparency = 1,
	})
	tween:Play()
	tween.Completed:Wait()
	aviso:Destroy()
end)

eventoSubiuDeNivel.OnClientEvent:Connect(function(novoNivel)
	local banner = Instance.new("TextLabel")
	banner.Size = UDim2.new(0, 400, 0, 60)
	banner.Position = UDim2.new(0.5, -200, 0.3, 0)
	banner.BackgroundTransparency = 1
	banner.Font = Enum.Font.GothamBold
	banner.TextSize = 36
	banner.TextColor3 = Color3.fromRGB(255, 215, 0)
	banner.TextTransparency = 1
	banner.Text = "NÍVEL " .. novoNivel .. "!"
	banner.Parent = tela

	TweenService:Create(banner, TweenInfo.new(0.3), { TextTransparency = 0 }):Play()
	task.wait(1.5)
	local saida = TweenService:Create(banner, TweenInfo.new(0.5), { TextTransparency = 1 })
	saida:Play()
	saida.Completed:Wait()
	banner:Destroy()
end)
